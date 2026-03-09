export type RadarPlatform = "linkedin" | "x" | "crosspost";

export type RadarProject = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  domain: string | null;
  repoName: string | null;
  productType: string | null;
  inventoryStatus: string | null;
  contactEmail: string | null;
  notes: string;
  analysisSummary: string;
  detectedKeywords: string[];
  platformHandles: Record<string, string>;
  scanQuery: string | null;
  active: boolean;
  autoScan: boolean;
  lastScannedAt: string | null;
  lastProposalAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RadarSignal = {
  id: string;
  projectId: string;
  sourceType: "domain" | "news" | "topic";
  title: string;
  url: string | null;
  summary: string;
  publishedAt: string | null;
  relevanceScore: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type RadarProposal = {
  id: string;
  projectId: string;
  variantIndex: number;
  headline: string;
  rationale: string;
  content: Record<RadarPlatform, string>;
  status: "draft" | "approved" | "posted" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type DashboardProject = RadarProject & {
  latestSignals: RadarSignal[];
  latestProposals: RadarProposal[];
};

export type RadarSummary = {
  projects: DashboardProject[];
  rebootImportAvailable: boolean;
  importedProjectCount: number;
  activeProjectCount: number;
  lastScannedAt: string | null;
};

export type RebootSeedProject = {
  name: string;
  domain: string | null;
  repoName?: string | null;
  productType?: string | null;
  inventoryStatus?: string | null;
  notes?: string | null;
};
