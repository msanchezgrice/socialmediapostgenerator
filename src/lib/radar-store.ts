import { randomUUID } from "node:crypto";
import { getRebootSeedProjects, rebootInventoryAvailable } from "@/lib/reboot-seed";
import { runRadarResearch, normalizeDomain, slugify, type RadarProposalDraft, type RadarResearchResult, type RadarSignalCandidate } from "@/lib/radar-research";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { DashboardProject, RadarProject, RadarProposal, RadarSignal, RadarSummary } from "@/lib/types";

type ProfileRow = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  profile_id: string;
  slug: string;
  name: string;
  domain: string | null;
  repo_name: string | null;
  product_type: string | null;
  inventory_status: string | null;
  contact_email: string | null;
  notes: string;
  analysis_summary: string;
  detected_keywords: string[] | null;
  platform_handles: Record<string, string> | null;
  scan_query: string | null;
  active: boolean;
  auto_scan: boolean;
  last_scanned_at: string | null;
  last_proposal_at: string | null;
  created_at: string;
  updated_at: string;
};

type SignalRow = {
  id: string;
  project_id: string;
  source_type: "domain" | "news" | "topic";
  title: string;
  url: string | null;
  summary: string;
  published_at: string | null;
  relevance_score: number;
  created_at: string;
};

type ProposalRow = {
  id: string;
  project_id: string;
  variant_index: number;
  headline: string;
  rationale: string;
  content: Record<string, string> | null;
  status: "draft" | "approved" | "posted" | "archived";
  created_at: string;
  updated_at: string;
};

type CreateProjectInput = {
  name: string;
  domain?: string | null;
  repoName?: string | null;
  productType?: string | null;
  inventoryStatus?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  scanQuery?: string | null;
  platformHandles?: Record<string, string>;
  active?: boolean;
  autoScan?: boolean;
};

function mapProject(row: ProjectRow): RadarProject {
  return {
    id: row.id,
    ownerId: row.profile_id,
    slug: row.slug,
    name: row.name,
    domain: row.domain,
    repoName: row.repo_name,
    productType: row.product_type,
    inventoryStatus: row.inventory_status,
    contactEmail: row.contact_email,
    notes: row.notes,
    analysisSummary: row.analysis_summary,
    detectedKeywords: Array.isArray(row.detected_keywords) ? row.detected_keywords : [],
    platformHandles: row.platform_handles ?? {},
    scanQuery: row.scan_query,
    active: row.active,
    autoScan: row.auto_scan,
    lastScannedAt: row.last_scanned_at,
    lastProposalAt: row.last_proposal_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSignal(row: SignalRow): RadarSignal {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type,
    title: row.title,
    url: row.url,
    summary: row.summary,
    publishedAt: row.published_at,
    relevanceScore: Number(row.relevance_score ?? 0),
    createdAt: row.created_at,
  };
}

function mapProposal(row: ProposalRow): RadarProposal {
  return {
    id: row.id,
    projectId: row.project_id,
    variantIndex: row.variant_index,
    headline: row.headline,
    rationale: row.rationale,
    content: {
      linkedin: typeof row.content?.linkedin === "string" ? row.content.linkedin : "",
      x: typeof row.content?.x === "string" ? row.content.x : "",
      crosspost: typeof row.content?.crosspost === "string" ? row.content.crosspost : "",
    },
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeHandles(input?: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    const trimmed = String(value || "").trim();
    if (!trimmed) continue;
    next[key] = trimmed;
  }
  return next;
}

export async function ensureProfile(input: { clerkUserId: string; email: string | null; name: string }) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id,clerk_user_id,email,name,created_at,updated_at")
    .eq("clerk_user_id", input.clerkUserId)
    .maybeSingle();

  if (error) throw new Error(`PROFILE_QUERY_FAILED:${error.message}`);
  if (existing) return existing as ProfileRow;

  const created: ProfileRow = {
    id: randomUUID(),
    clerk_user_id: input.clerkUserId,
    email: input.email,
    name: input.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from("profiles").insert(created);
  if (insertError) throw new Error(`PROFILE_CREATE_FAILED:${insertError.message}`);
  return created;
}

async function listProjects(profileId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("radar_projects")
    .select("id,profile_id,slug,name,domain,repo_name,product_type,inventory_status,contact_email,notes,analysis_summary,detected_keywords,platform_handles,scan_query,active,auto_scan,last_scanned_at,last_proposal_at,created_at,updated_at")
    .eq("profile_id", profileId)
    .order("active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`PROJECTS_QUERY_FAILED:${error.message}`);
  return (data ?? []) as ProjectRow[];
}

async function listSignals(projectIds: string[]) {
  if (!projectIds.length) return [] as SignalRow[];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("radar_signals")
    .select("id,project_id,source_type,title,url,summary,published_at,relevance_score,created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`SIGNALS_QUERY_FAILED:${error.message}`);
  return (data ?? []) as SignalRow[];
}

async function listProposals(projectIds: string[]) {
  if (!projectIds.length) return [] as ProposalRow[];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("radar_proposals")
    .select("id,project_id,variant_index,headline,rationale,content,status,created_at,updated_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`PROPOSALS_QUERY_FAILED:${error.message}`);
  return (data ?? []) as ProposalRow[];
}

function groupByProjectId<T extends { project_id?: string; projectId?: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.project_id ?? row.projectId;
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }
  return grouped;
}

export async function getRadarSummary(profileId: string): Promise<RadarSummary> {
  const rows = await listProjects(profileId);
  const projectIds = rows.map((row) => row.id);
  const signalRows = await listSignals(projectIds);
  const proposalRows = await listProposals(projectIds);
  const groupedSignals = groupByProjectId(signalRows);
  const groupedProposals = groupByProjectId(proposalRows);

  const projects: DashboardProject[] = rows.map((row) => ({
    ...mapProject(row),
    latestSignals: (groupedSignals.get(row.id) ?? []).slice(0, 4).map((entry) => mapSignal(entry as SignalRow)),
    latestProposals: (groupedProposals.get(row.id) ?? [])
      .slice(0, 3)
      .sort((left, right) => ((left as ProposalRow).variant_index ?? 0) - ((right as ProposalRow).variant_index ?? 0))
      .map((entry) => mapProposal(entry as ProposalRow)),
  }));

  return {
    projects,
    rebootImportAvailable: await rebootInventoryAvailable(),
    importedProjectCount: projects.length,
    activeProjectCount: projects.filter((project) => project.active).length,
    lastScannedAt:
      projects
        .map((project) => project.lastScannedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null,
  };
}

async function upsertProjects(profileId: string, entries: CreateProjectInput[]) {
  const supabase = getSupabaseAdmin();
  const existing = await listProjects(profileId);
  const bySlug = new Map(existing.map((row) => [row.slug, row]));

  let count = 0;
  for (const entry of entries) {
    const slug = slugify(entry.name || entry.domain || randomUUID());
    const payload = {
      profile_id: profileId,
      slug,
      name: entry.name.trim(),
      domain: normalizeDomain(entry.domain) ?? null,
      repo_name: entry.repoName?.trim() || null,
      product_type: entry.productType?.trim() || null,
      inventory_status: entry.inventoryStatus?.trim() || null,
      contact_email: entry.contactEmail?.trim() || null,
      notes: entry.notes?.trim() || "",
      scan_query: entry.scanQuery?.trim() || null,
      platform_handles: normalizeHandles(entry.platformHandles),
      active: entry.active ?? true,
      auto_scan: entry.autoScan ?? true,
      updated_at: new Date().toISOString(),
    };

    if (bySlug.has(slug)) {
      const { error } = await supabase.from("radar_projects").update(payload).eq("profile_id", profileId).eq("slug", slug);
      if (error) throw new Error(`PROJECT_UPDATE_FAILED:${error.message}`);
      count += 1;
      continue;
    }

    const { error } = await supabase.from("radar_projects").insert({
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...payload,
    });
    if (error) throw new Error(`PROJECT_CREATE_FAILED:${error.message}`);
    count += 1;
  }

  return count;
}

export async function importRebootInventory(profileId: string) {
  const entries = await getRebootSeedProjects();
  const importedCount = await upsertProjects(
    profileId,
    entries.map((entry) => ({
      name: entry.name,
      domain: entry.domain,
      repoName: entry.repoName,
      productType: entry.productType,
      inventoryStatus: entry.inventoryStatus,
      notes: entry.notes,
      scanQuery: [entry.name, entry.productType].filter(Boolean).join(" "),
      active: true,
      autoScan: true,
    })),
  );

  return { importedCount };
}

export async function createManualProjects(profileId: string, entries: CreateProjectInput[]) {
  const createdCount = await upsertProjects(profileId, entries);
  return { createdCount };
}

async function getOwnedProject(profileId: string, projectId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("radar_projects")
    .select("id,profile_id,slug,name,domain,repo_name,product_type,inventory_status,contact_email,notes,analysis_summary,detected_keywords,platform_handles,scan_query,active,auto_scan,last_scanned_at,last_proposal_at,created_at,updated_at")
    .eq("profile_id", profileId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`PROJECT_FETCH_FAILED:${error.message}`);
  return (data as ProjectRow | null) ?? null;
}

export async function updateProject(
  profileId: string,
  projectId: string,
  patch: Partial<{
    name: string;
    domain: string | null;
    repoName: string | null;
    productType: string | null;
    inventoryStatus: string | null;
    contactEmail: string | null;
    notes: string | null;
    scanQuery: string | null;
    active: boolean;
    autoScan: boolean;
    platformHandles: Record<string, string>;
  }>,
) {
  const project = await getOwnedProject(profileId, projectId);
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.name === "string" && patch.name.trim()) {
    updates.name = patch.name.trim();
    updates.slug = slugify(patch.name);
  }
  if ("domain" in patch) updates.domain = normalizeDomain(patch.domain) ?? null;
  if ("repoName" in patch) updates.repo_name = patch.repoName?.trim() || null;
  if ("productType" in patch) updates.product_type = patch.productType?.trim() || null;
  if ("inventoryStatus" in patch) updates.inventory_status = patch.inventoryStatus?.trim() || null;
  if ("contactEmail" in patch) updates.contact_email = patch.contactEmail?.trim() || null;
  if ("notes" in patch) updates.notes = patch.notes?.trim() || "";
  if ("scanQuery" in patch) updates.scan_query = patch.scanQuery?.trim() || null;
  if ("active" in patch) updates.active = Boolean(patch.active);
  if ("autoScan" in patch) updates.auto_scan = Boolean(patch.autoScan);
  if ("platformHandles" in patch) updates.platform_handles = normalizeHandles(patch.platformHandles);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("radar_projects").update(updates).eq("id", projectId);
  if (error) throw new Error(`PROJECT_PATCH_FAILED:${error.message}`);
  return { ok: true };
}

function signalRows(projectId: string, signals: RadarSignalCandidate[]) {
  return signals.map((signal) => ({
    id: randomUUID(),
    project_id: projectId,
    source_type: signal.sourceType,
    title: signal.title,
    url: signal.url,
    summary: signal.summary,
    published_at: signal.publishedAt,
    relevance_score: signal.relevanceScore,
    metadata: signal.metadata,
  }));
}

function proposalRows(projectId: string, proposals: RadarProposalDraft[]) {
  return proposals.map((proposal) => ({
    id: randomUUID(),
    project_id: projectId,
    variant_index: proposal.variantIndex,
    headline: proposal.headline,
    rationale: proposal.rationale,
    content: proposal.content,
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

async function persistResearch(project: ProjectRow, research: RadarResearchResult) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("radar_projects")
    .update({
      analysis_summary: research.analysisSummary,
      detected_keywords: research.detectedKeywords,
      last_scanned_at: nowIso,
      last_proposal_at: research.proposals.length ? nowIso : project.last_proposal_at,
      updated_at: nowIso,
    })
    .eq("id", project.id);

  if (updateError) throw new Error(`PROJECT_RESEARCH_UPDATE_FAILED:${updateError.message}`);

  await supabase.from("radar_signals").delete().eq("project_id", project.id);
  await supabase.from("radar_proposals").delete().eq("project_id", project.id);

  const nextSignalRows = signalRows(project.id, research.signals);
  const nextProposalRows = proposalRows(project.id, research.proposals);

  if (nextSignalRows.length) {
    const { error } = await supabase.from("radar_signals").insert(nextSignalRows);
    if (error) throw new Error(`SIGNALS_INSERT_FAILED:${error.message}`);
  }
  if (nextProposalRows.length) {
    const { error } = await supabase.from("radar_proposals").insert(nextProposalRows);
    if (error) throw new Error(`PROPOSALS_INSERT_FAILED:${error.message}`);
  }
}

export async function refreshProject(profileId: string, projectId: string) {
  const project = await getOwnedProject(profileId, projectId);
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const research = await runRadarResearch({
    name: project.name,
    domain: project.domain,
    productType: project.product_type,
    notes: project.notes,
    scanQuery: project.scan_query,
    existingSummary: project.analysis_summary,
    existingKeywords: project.detected_keywords ?? [],
  });

  await persistResearch(project, research);
  return research;
}

function dateKeyInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function refreshDueProjects(options?: { limit?: number; forceAll?: boolean }) {
  const supabase = getSupabaseAdmin();
  const timeZone = process.env.RADAR_DEFAULT_TIMEZONE?.trim() || "America/New_York";
  const limit = Math.max(1, Math.min(8, Number(options?.limit ?? 3)));
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);

  const { data, error } = await supabase
    .from("radar_projects")
    .select("id,profile_id,slug,name,domain,repo_name,product_type,inventory_status,contact_email,notes,analysis_summary,detected_keywords,platform_handles,scan_query,active,auto_scan,last_scanned_at,last_proposal_at,created_at,updated_at")
    .eq("active", true)
    .eq("auto_scan", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) throw new Error(`DUE_PROJECTS_QUERY_FAILED:${error.message}`);
  const rows = (data ?? []) as ProjectRow[];
  const dueProjects = rows.filter((project) => {
    if (options?.forceAll) return true;
    if (!project.last_scanned_at) return true;
    return dateKeyInTimeZone(new Date(project.last_scanned_at), timeZone) !== todayKey;
  });

  const refreshed: string[] = [];
  for (const project of dueProjects.slice(0, limit)) {
    const research = await runRadarResearch({
      name: project.name,
      domain: project.domain,
      productType: project.product_type,
      notes: project.notes,
      scanQuery: project.scan_query,
      existingSummary: project.analysis_summary,
      existingKeywords: project.detected_keywords ?? [],
    });
    await persistResearch(project, research);
    refreshed.push(project.id);
  }

  return {
    refreshedCount: refreshed.length,
    refreshedProjectIds: refreshed,
  };
}

