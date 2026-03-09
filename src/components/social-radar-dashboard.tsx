"use client";

import { useEffect, useState, useTransition } from "react";
import type { DashboardProject, RadarSummary, XHandleSuggestion } from "@/lib/types";

type EditorState = {
  name: string;
  domain: string;
  repoName: string;
  productType: string;
  inventoryStatus: string;
  contactEmail: string;
  notes: string;
  scanQuery: string;
  active: boolean;
  autoScan: boolean;
  linkedin: string;
  x: string;
  crosspost: string;
  website: string;
};

type XHandleSuggestionState = {
  suggestions: XHandleSuggestion[];
  checkedWithXApi: boolean;
  note: string;
};

const emptyEditor: EditorState = {
  name: "",
  domain: "",
  repoName: "",
  productType: "",
  inventoryStatus: "",
  contactEmail: "",
  notes: "",
  scanQuery: "",
  active: true,
  autoScan: true,
  linkedin: "",
  x: "",
  crosspost: "",
  website: "",
};

function editorFromProject(project: DashboardProject | null): EditorState {
  if (!project) return emptyEditor;
  return {
    name: project.name || "",
    domain: project.domain || "",
    repoName: project.repoName || "",
    productType: project.productType || "",
    inventoryStatus: project.inventoryStatus || "",
    contactEmail: project.contactEmail || "",
    notes: project.notes || "",
    scanQuery: project.scanQuery || "",
    active: project.active,
    autoScan: project.autoScan,
    linkedin: project.platformHandles.linkedin || "",
    x: project.platformHandles.x || "",
    crosspost: project.platformHandles.crosspost || "",
    website: project.platformHandles.website || project.domain || "",
  };
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function titleizeDomain(input: string) {
  const normalized = input
    .trim()
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .split(".")[0]
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
  if (!normalized) return "Untitled Project";
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseBulkEntries(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length >= 2) {
        return {
          name: parts[0] || titleizeDomain(parts[1]),
          domain: parts[1] || null,
          notes: parts[2] || null,
          contactEmail: parts[3] || null,
        };
      }
      return {
        name: titleizeDomain(parts[0]),
        domain: parts[0],
        notes: null,
        contactEmail: null,
      };
    });
}

function composerUrl(platform: "linkedin" | "x", text: string) {
  return platform === "linkedin"
    ? `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function xAvailabilityClasses(status: XHandleSuggestion["availability"]) {
  if (status === "likely_available") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "taken") return "border-rose-500/25 bg-rose-500/10 text-rose-300";
  if (status === "unchecked") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "invalid") return "border-slate-500/25 bg-slate-500/10 text-slate-300";
  return "border-white/10 bg-white/[0.03] text-slate-300";
}

function xAvailabilityLabel(status: XHandleSuggestion["availability"]) {
  if (status === "likely_available") return "Likely available";
  if (status === "taken") return "Taken";
  if (status === "unchecked") return "Unchecked";
  if (status === "invalid") return "Invalid";
  return "Unknown";
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: { message?: string };
  };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error?.message || "Request failed");
  }
  return data;
}

export function SocialRadarDashboard({ initialSummary }: { initialSummary: RadarSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [selectedProjectId, setSelectedProjectId] = useState(initialSummary.projects[0]?.id ?? "");
  const [editor, setEditor] = useState<EditorState>(editorFromProject(initialSummary.projects[0] ?? null));
  const [xHandleSuggestions, setXHandleSuggestions] = useState<Record<string, XHandleSuggestionState>>({});
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCompanyContext, setShowCompanyContext] = useState(false);
  const [showSignals, setShowSignals] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [status, setStatus] = useState("Dashboard ready.");
  const [statusError, setStatusError] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selectedProject = summary.projects.find((project) => project.id === selectedProjectId) ?? summary.projects[0] ?? null;
  const selectedProjectHandleSuggestions = selectedProject ? xHandleSuggestions[selectedProject.id] ?? null : null;

  useEffect(() => {
    if (!summary.projects.length) {
      setSelectedProjectId("");
      setEditor(emptyEditor);
      return;
    }
    if (!selectedProjectId || !summary.projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(summary.projects[0].id);
    }
  }, [selectedProjectId, summary.projects]);

  useEffect(() => {
    setEditor(editorFromProject(selectedProject));
  }, [selectedProject]);

  async function reload() {
    const data = await requestJson<{ summary: RadarSummary }>("/api/social-radar/summary");
    startTransition(() => setSummary(data.summary));
  }

  async function runAction(key: string, work: () => Promise<void>, successMessage: string) {
    setPendingAction(key);
    setStatus("");
    try {
      await work();
      await reload();
      setStatus(successMessage);
      setStatusError(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed");
      setStatusError(true);
    } finally {
      setPendingAction(null);
    }
  }

  async function importReboot() {
    await runAction(
      "import",
      async () => {
        await requestJson("/api/social-radar/import/reboot", { method: "POST" });
      },
      "Imported Reboot inventory.",
    );
  }

  async function addProjects() {
    const entries = parseBulkEntries(bulkInput);
    if (!entries.length) {
      setStatus("Add at least one domain or `Name | domain.com | notes | email` line.");
      setStatusError(true);
      return;
    }

    await runAction(
      "create",
      async () => {
        await requestJson("/api/social-radar/projects", {
          method: "POST",
          body: JSON.stringify({ entries }),
        });
        setBulkInput("");
      },
      "Added new projects.",
    );
  }

  async function saveProject() {
    if (!selectedProject) return;
    await runAction(
      `save:${selectedProject.id}`,
      async () => {
        await requestJson(`/api/social-radar/projects/${selectedProject.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: editor.name,
            domain: editor.domain || null,
            repoName: editor.repoName || null,
            productType: editor.productType || null,
            inventoryStatus: editor.inventoryStatus || null,
            contactEmail: editor.contactEmail || null,
            notes: editor.notes || null,
            scanQuery: editor.scanQuery || null,
            active: editor.active,
            autoScan: editor.autoScan,
            platformHandles: {
              linkedin: editor.linkedin,
              x: editor.x,
              crosspost: editor.crosspost,
              website: editor.website,
            },
          }),
        });
      },
      "Saved project settings.",
    );
  }

  async function refreshProject() {
    if (!selectedProject) return;
    await runAction(
      `refresh:${selectedProject.id}`,
      async () => {
        await requestJson(`/api/social-radar/projects/${selectedProject.id}/refresh`, {
          method: "POST",
        });
      },
      `Refreshed ${selectedProject.name}.`,
    );
  }

  async function suggestXHandlesForProject() {
    if (!selectedProject) return;
    const key = `x-suggest:${selectedProject.id}`;
    setPendingAction(key);
    setStatus("");

    try {
      const data = await requestJson<XHandleSuggestionState>(`/api/social-radar/projects/${selectedProject.id}/x-handle-suggestions`);
      setXHandleSuggestions((current) => ({
        ...current,
        [selectedProject.id]: data,
      }));
      setStatus(data.checkedWithXApi ? "Loaded X handle suggestions." : "Loaded X handle suggestions without live X verification.");
      setStatusError(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load X handle suggestions.");
      setStatusError(true);
    } finally {
      setPendingAction(null);
    }
  }

  async function runCronNow() {
    setPendingAction("cron");
    setStatus("");
    try {
      const data = await requestJson<{ refreshedCount: number }>("/api/social-radar/batch", {
        method: "POST",
      });
      await reload();
      const count = Number(data.refreshedCount ?? 0);
      setStatus(count ? `Ran batch for ${count} active project${count === 1 ? "" : "s"}.` : "No active projects were due for scanning.");
      setStatusError(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed");
      setStatusError(true);
    } finally {
      setPendingAction(null);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard.");
      setStatusError(false);
    } catch {
      setStatus("Clipboard copy failed.");
      setStatusError(true);
    }
  }

  function openComposer(platform: "linkedin" | "x", text: string) {
    window.open(composerUrl(platform, text), "_blank", "noopener,noreferrer");
    setStatus(platform === "linkedin" ? "Opened LinkedIn composer." : "Opened X composer.");
    setStatusError(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[25%_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-8.5rem)] lg:flex-col lg:overflow-hidden">
        <section className="rounded-[28px] border border-white/10 bg-black/30 p-4 backdrop-blur lg:shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#5eead4]">Workspace</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Portfolio console</h2>
              <p className="mt-1 text-xs leading-6 text-slate-400">Compact intake on the left. Full company workspace on the right.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickAdd((value) => !value)}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-200 transition hover:bg-white/10"
            >
              {showQuickAdd ? "Hide add" : "Add"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tracked</div>
              <div className="mt-1 text-lg font-semibold text-white">{summary.importedProjectCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active</div>
              <div className="mt-1 text-lg font-semibold text-white">{summary.activeProjectCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Last scan</div>
              <div className="mt-1 text-xs font-medium leading-5 text-white">{formatDate(summary.lastScannedAt)}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runCronNow()}
              disabled={Boolean(pendingAction)}
              className="rounded-full border border-white/15 px-3 py-2 text-xs text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              Run Batch
            </button>
            <button
              type="button"
              onClick={() => void importReboot()}
              disabled={Boolean(pendingAction)}
              className="rounded-full border border-[#14b8a6]/25 bg-[#14b8a6]/10 px-3 py-2 text-xs text-[#5eead4] transition hover:bg-[#14b8a6]/20 disabled:opacity-60"
            >
              Import Reboot
            </button>
          </div>

          {showQuickAdd ? (
            <div className="mt-4 rounded-[22px] border border-white/10 bg-[#07121b] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#5eead4]">Quick intake</div>
                  <p className="mt-1 text-xs leading-6 text-slate-400">One line per project. `Name | domain.com | notes | email`.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void addProjects()}
                  disabled={Boolean(pendingAction)}
                  className="rounded-full bg-[#14b8a6] px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-[#2dd4bf] disabled:opacity-60"
                >
                  Add
                </button>
              </div>
              <textarea
                value={bulkInput}
                onChange={(event) => setBulkInput(event.target.value)}
                placeholder={"LidVault | lidvault.com | HIPAA ophthalmology | ops@lidvault.com\nsurgeryviz.com"}
                className="mt-3 min-h-[132px] w-full rounded-[18px] border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
          ) : null}

          <div className={`mt-4 min-h-5 text-xs ${statusError ? "text-rose-300" : "text-emerald-300"}`}>{status}</div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-black/25 p-3 backdrop-blur lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="flex items-center justify-between border-b border-white/5 px-2 pb-3">
            <div>
              <h3 className="text-base font-semibold text-white">Companies</h3>
              <p className="text-[11px] text-slate-400">Choose one and work it on the right.</p>
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{summary.projects.length}</div>
          </div>
          <div
            onWheelCapture={(event) => event.stopPropagation()}
            className="mt-3 space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
          >
            {summary.projects.length ? (
              summary.projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={
                    "w-full rounded-[20px] border px-3 py-3 text-left transition " +
                    (selectedProject?.id === project.id
                      ? "border-[#14b8a6]/35 bg-[#0a1721] shadow-[inset_0_1px_0_rgba(94,234,212,0.08)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{project.name}</div>
                      <div className="mt-1 truncate text-[11px] text-slate-400">{project.domain || "No domain yet"}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.16em] ${project.active ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-600/35 text-slate-400"}`}>
                      {project.active ? "On" : "Off"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {project.productType ? (
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-300">{project.productType}</span>
                    ) : null}
                    {project.detectedKeywords.slice(0, 2).map((keyword) => (
                      <span key={keyword} className="rounded-full border border-[#14b8a6]/20 px-2 py-1 text-[10px] text-[#5eead4]">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                Import the Reboot seed or add domains manually to start the isolated company list.
              </div>
            )}
          </div>
        </section>
      </aside>

      <div className="space-y-5 lg:min-h-[calc(100vh-8.5rem)]">
        <section className="rounded-[32px] border border-white/10 bg-black/25 p-5 backdrop-blur lg:min-h-[calc(100vh-8.5rem)] lg:overflow-y-auto">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#5eead4]">Company workspace</div>
                <h3 className="mt-2 text-3xl font-semibold text-white">{selectedProject ? selectedProject.name : "Select a project"}</h3>
                <p className="mt-1 max-w-3xl text-sm text-slate-400">
                  {selectedProject ? "Store company metadata, email, handles, and scanning settings." : "Choose a project to edit settings and review signals."}
                </p>
                {selectedProject ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProject.domain ? <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300">{selectedProject.domain}</span> : null}
                    {selectedProject.productType ? <span className="rounded-full border border-[#14b8a6]/20 px-3 py-1 text-[11px] text-[#5eead4]">{selectedProject.productType}</span> : null}
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-300">Last scan {formatDate(selectedProject.lastScannedAt)}</span>
                  </div>
                ) : null}
              </div>
              {selectedProject ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveProject()}
                    disabled={Boolean(pendingAction)}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshProject()}
                    disabled={Boolean(pendingAction)}
                    className="rounded-full bg-[#14b8a6] px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-[#2dd4bf] disabled:opacity-60"
                  >
                    Refresh
                  </button>
                </div>
              ) : null}
            </div>

            <section className="rounded-[28px] border border-white/10 bg-[#050b12]/70 p-4">
              <button
                type="button"
                onClick={() => setShowCompanyContext((value) => !value)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div>
                  <h3 className="text-2xl font-semibold text-white">Company context</h3>
                  <p className="mt-1 text-sm text-slate-400">Metadata, handles, scanning rules, and current positioning.</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                  {showCompanyContext ? "Hide" : "Show"}
                </span>
              </button>

              {showCompanyContext && selectedProject ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Company name</span>
                      <input value={editor.name} onChange={(e) => setEditor((s) => ({ ...s, name: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Domain</span>
                      <input value={editor.domain} onChange={(e) => setEditor((s) => ({ ...s, domain: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Repo</span>
                      <input value={editor.repoName} onChange={(e) => setEditor((s) => ({ ...s, repoName: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Product type</span>
                      <input value={editor.productType} onChange={(e) => setEditor((s) => ({ ...s, productType: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Inventory status</span>
                      <input value={editor.inventoryStatus} onChange={(e) => setEditor((s) => ({ ...s, inventoryStatus: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Contact email</span>
                      <input value={editor.contactEmail} onChange={(e) => setEditor((s) => ({ ...s, contactEmail: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Scan query</span>
                      <input value={editor.scanQuery} onChange={(e) => setEditor((s) => ({ ...s, scanQuery: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</span>
                      <textarea value={editor.notes} onChange={(e) => setEditor((s) => ({ ...s, notes: e.target.value }))} className="min-h-[120px] w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">LinkedIn</span>
                      <input value={editor.linkedin} onChange={(e) => setEditor((s) => ({ ...s, linkedin: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">X handle</span>
                        <button
                          type="button"
                          onClick={() => void suggestXHandlesForProject()}
                          disabled={Boolean(pendingAction)}
                          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                        >
                          Suggest
                        </button>
                      </div>
                      <input value={editor.x} onChange={(e) => setEditor((s) => ({ ...s, x: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                      {selectedProjectHandleSuggestions ? (
                        <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[#5eead4]">Suggested handles</div>
                          <p className="mt-2 text-xs leading-6 text-slate-400">{selectedProjectHandleSuggestions.note}</p>
                          <div className="mt-3 space-y-2">
                            {selectedProjectHandleSuggestions.suggestions.map((suggestion) => {
                              const handleUrl = suggestion.profileUrl || `https://x.com/${suggestion.handle}`;
                              return (
                                <div key={suggestion.handle} className="rounded-2xl border border-white/10 bg-[#07121b] p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <a href={handleUrl} target="_blank" rel="noreferrer" className="font-medium text-white underline decoration-white/20 underline-offset-4 hover:text-[#5eead4]">
                                          @{suggestion.handle}
                                        </a>
                                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${xAvailabilityClasses(suggestion.availability)}`}>
                                          {xAvailabilityLabel(suggestion.availability)}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-xs leading-6 text-slate-400">{suggestion.reason}</p>
                                    </div>
                                    {suggestion.availability !== "taken" && suggestion.availability !== "invalid" ? (
                                      <button
                                        type="button"
                                        onClick={() => setEditor((state) => ({ ...state, x: `@${suggestion.handle}` }))}
                                        className="rounded-full border border-[#14b8a6]/25 bg-[#14b8a6]/10 px-3 py-1 text-[11px] text-[#5eead4] transition hover:bg-[#14b8a6]/20"
                                      >
                                        Use
                                      </button>
                                    ) : (
                                      <a href={handleUrl} target="_blank" rel="noreferrer" className="text-[11px] text-slate-300 hover:text-white">
                                        Open
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Cross-post target</span>
                      <input value={editor.crosspost} onChange={(e) => setEditor((s) => ({ ...s, crosspost: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Website override</span>
                      <input value={editor.website} onChange={(e) => setEditor((s) => ({ ...s, website: e.target.value }))} className="w-full rounded-[18px] border border-white/10 bg-[#07121b] px-4 py-3 text-sm text-white outline-none" />
                    </label>
                    <label className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div>
                        <div className="font-medium text-white">Active</div>
                        <div className="text-xs text-slate-500">Include in the dashboard list and manual review.</div>
                      </div>
                      <input type="checkbox" checked={editor.active} onChange={(e) => setEditor((s) => ({ ...s, active: e.target.checked }))} className="h-5 w-5" />
                    </label>
                    <label className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div>
                        <div className="font-medium text-white">Daily auto-scan</div>
                        <div className="text-xs text-slate-500">Include in the scheduled Vercel cron batch.</div>
                      </div>
                      <input type="checkbox" checked={editor.autoScan} onChange={(e) => setEditor((s) => ({ ...s, autoScan: e.target.checked }))} className="h-5 w-5" />
                    </label>
                  </div>

                  {selectedProject.analysisSummary ? (
                    <div className="rounded-[24px] border border-[#14b8a6]/20 bg-[#07121b] p-4 text-sm leading-7 text-slate-300">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#5eead4]">Latest analysis</div>
                      {selectedProject.analysisSummary}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#050b12]/70 p-4">
              <button
                type="button"
                onClick={() => setShowSignals((value) => !value)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div>
                  <h3 className="text-2xl font-semibold text-white">Signals</h3>
                  <p className="mt-1 text-sm text-slate-400">Homepage and live-web inputs shaping the current narrative.</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                  {showSignals ? "Hide" : "Show"}
                </span>
              </button>
              {showSignals ? (
                <div className="mt-5 space-y-3">
                  {selectedProject?.latestSignals.length ? (
                    selectedProject.latestSignals.map((signal) => (
                      <article key={signal.id} className="rounded-[24px] border border-white/10 bg-[#07121b] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#14b8a6]/20 bg-[#14b8a6]/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#5eead4]">
                            {signal.sourceType}
                          </span>
                          <span className="text-[11px] text-slate-500">{formatDate(signal.publishedAt || signal.createdAt)}</span>
                          <span className="text-[11px] text-slate-500">Relevance {Math.round(signal.relevanceScore)}</span>
                        </div>
                        <h4 className="mt-3 text-sm font-semibold text-white">{signal.title}</h4>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{signal.summary}</p>
                        {signal.url ? (
                          <a href={signal.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs text-[#5eead4] hover:text-white">
                            Open source
                          </a>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                      Run a refresh to populate this company’s signals.
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#050b12]/70 p-4">
              <h3 className="text-2xl font-semibold text-white">Packaged posts</h3>
              <p className="mt-1 text-sm text-slate-400">Three options, each ready for native LinkedIn or X posting.</p>
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {selectedProject?.latestProposals.length ? (
                selectedProject.latestProposals.map((proposal) => (
                  <article key={proposal.id} className="rounded-[24px] border border-white/10 bg-[#07121b] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#5eead4]">Option {proposal.variantIndex}</div>
                      <div className="text-[11px] text-slate-500">{proposal.status}</div>
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-white">{proposal.headline}</h4>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{proposal.rationale}</p>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-[18px] border border-[#0a66c2]/20 bg-[#0a66c2]/10 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-[#7cc3ff]">LinkedIn</span>
                          <div className="flex gap-2 text-[11px]">
                            <button type="button" onClick={() => void copyText(proposal.content.linkedin)} className="text-slate-300 hover:text-white">Copy</button>
                            <button type="button" onClick={() => openComposer("linkedin", proposal.content.linkedin)} className="text-[#7cc3ff] hover:text-white">Open</button>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{proposal.content.linkedin}</p>
                      </div>

                      <div className="rounded-[18px] border border-white/10 bg-black/25 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-white">X</span>
                          <div className="flex gap-2 text-[11px]">
                            <button type="button" onClick={() => void copyText(proposal.content.x)} className="text-slate-300 hover:text-white">Copy</button>
                            <button type="button" onClick={() => openComposer("x", proposal.content.x)} className="text-[#5eead4] hover:text-white">Open</button>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{proposal.content.x}</p>
                      </div>

                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Cross-post</span>
                          <button type="button" onClick={() => void copyText(proposal.content.crosspost)} className="text-[11px] text-slate-300 hover:text-white">Copy</button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{proposal.content.crosspost}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400 xl:col-span-3">
                    Refresh a project to generate the first proposal set.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
