import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import type { RebootSeedProject } from "@/lib/types";

const rebootSeed: RebootSeedProject[] = [
  { name: "LidVault", domain: "lidvault.com", repoName: "lidvault", productType: "HIPAA ophthalmology", inventoryStatus: "Landing", notes: "High-potential medical workflow product." },
  { name: "SurgeryViz", domain: "surgeryviz.com", repoName: "SurgeryViz", productType: "Medical AI simulation", inventoryStatus: "Landing", notes: "Medical-grade surgery simulation and visualization." },
  { name: "TalkingObject", domain: "talkingobject.com", repoName: "talkingobject", productType: "Interactive objects", inventoryStatus: "Landing", notes: "Needs clean security posture before promotion." },
  { name: "OpenTo", domain: "opento.ai", repoName: "opento", productType: "Open-ended AI workflow", inventoryStatus: "Landing", notes: "" },
  { name: "MeanCofounder", domain: "meancofounder.com", repoName: "meancofounder", productType: "Tough-love startup feedback", inventoryStatus: "Landing", notes: "" },
  { name: "LaunchReady", domain: "launchready.me", repoName: "launchready", productType: "Launch confidence tooling", inventoryStatus: "Landing", notes: "" },
  { name: "ThinkingObject", domain: "thinkingobject.com", repoName: "thinkingobject", productType: "Thinking objects", inventoryStatus: "Landing", notes: "" },
  { name: "StartCloseIn", domain: "startclosein.com", repoName: "startclosein", productType: "Startup execution", inventoryStatus: "Landing", notes: "" },
  { name: "CTOHelpers", domain: "ctohelpers.com", repoName: "ctohelpers", productType: "CTO assistance", inventoryStatus: "Landing", notes: "" },
  { name: "HelpMeCode", domain: "helpmecode.ai", repoName: "helpmecode", productType: "Coding help", inventoryStatus: "Landing", notes: "Placeholder and parked." },
  { name: "MyForeverSongs", domain: "myforeversongs.com", repoName: "myforeversongs", productType: "Song creation", inventoryStatus: "Landing", notes: "Placeholder and parked." },
  { name: "IdeaPolish", domain: "ideapolish.com", repoName: "ideapolish", productType: "Idea refinement", inventoryStatus: "Landing", notes: "Placeholder and parked." },
  { name: "ShipAlready", domain: "shipalready.com", repoName: "shipalready", productType: "Shipping products", inventoryStatus: "Landing", notes: "" },
  { name: "WhereImSpendingTime", domain: "whereimspendingtime.com", repoName: "whereimspendingtime", productType: "Time tracking", inventoryStatus: "Landing", notes: "" },
  { name: "DumbUser", domain: "dumbuser.com", repoName: "dumbuser", productType: "User testing", inventoryStatus: "Landing", notes: "Placeholder and parked." },
  { name: "ManagersToMakers", domain: "managerstomakers.com", repoName: "managerstomakers", productType: "Career transition", inventoryStatus: "Landing", notes: "Placeholder and parked." },
  { name: "StartupCofounder", domain: "startupcofounder.co", repoName: "startupcofounder", productType: "Cofounder matching", inventoryStatus: "Landing", notes: "Placeholder and parked." },
  { name: "IdeaResearcher", domain: "idearesearcher.com", repoName: "idearesearcher", productType: "Idea research", inventoryStatus: "Landing", notes: "Coming soon page." },
  { name: "Warmstart", domain: "warmstart.it", repoName: "warmstart", productType: "AI browser demo agents", inventoryStatus: "Live", notes: "Primary product with active functionality." },
  { name: "Clipcade", domain: "clipcade.com", repoName: "clipcade", productType: "Mini-app social platform", inventoryStatus: "Live", notes: "" },
  { name: "ShipShow", domain: "shipshow.io", repoName: "ShipShowDaily", productType: "Daily demo leaderboard", inventoryStatus: "Live", notes: "" },
  { name: "Doodad.ai", domain: "doodad.ai", repoName: "sideprojecttracker", productType: "AI project organizer", inventoryStatus: "Live", notes: "" },
  { name: "ConjureAnything", domain: "conjureanything.com", repoName: "ConjureAnything", productType: "AI product architect", inventoryStatus: "Live", notes: "" },
  { name: "VirtualCofounder", domain: "virtualcofounder.ai", repoName: "virtualcofounder", productType: "AI team builder", inventoryStatus: "Live", notes: "" },
  { name: "IdeaFeedback", domain: "ideafeedback.co", repoName: "interviewhelper", productType: "AI interview copilot", inventoryStatus: "Live", notes: "" },
  { name: "Wishmode", domain: "wishmode.co", repoName: "wishmode", productType: "Bucket list visualizer", inventoryStatus: "Live", notes: "" },
  { name: "NametoBiz", domain: "nametobiz.com", repoName: "nametobiz", productType: "Domain to prototype", inventoryStatus: "Live", notes: "" },
  { name: "AgingOrDying", domain: "agingordying.com", repoName: "agingordying", productType: "Health navigation", inventoryStatus: "Live", notes: "" },
  { name: "AlphaArena", domain: "alphaarena.co", repoName: "alphaarena", productType: "AI investment platform", inventoryStatus: "Live", notes: "" },
  { name: "ManagerToMaker", domain: "managertomaker.com", repoName: "managertomaker", productType: "Career transition app", inventoryStatus: "Live", notes: "" },
];

type CsvRow = {
  name: string;
  domain: string | null;
  repoName: string | null;
  productType: string | null;
  inventoryStatus: string | null;
  notes: string | null;
};

function parseCsv(content: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim().length));
}

function normalizeDomain(input: string | null | undefined) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed === "n/a") return null;
  return trimmed.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;
}

function shouldInclude(status: string, notes: string) {
  const normalizedStatus = status.toLowerCase();
  const normalizedNotes = notes.toLowerCase();
  if (normalizedStatus.includes("dmca") || normalizedStatus.includes("error")) return false;
  if (normalizedNotes.includes("not miguel") || normalizedNotes.includes("not mine")) return false;
  return normalizedStatus.includes("active") || normalizedStatus.includes("landing") || normalizedStatus.includes("coming soon");
}

async function readLocalRebootCsv() {
  const path = process.env.REBOOT_PROJECT_INVENTORY_PATH?.trim() || "/Users/miguel/Reboot/PROJECT_MASTER_LIST.csv";
  try {
    await access(path, constants.R_OK);
  } catch {
    return null;
  }

  const content = await readFile(path, "utf8");
  const rows = parseCsv(content);
  const [header, ...records] = rows;
  if (!header?.length) return null;

  const indexByName = new Map(header.map((column, index) => [column.trim(), index]));
  const valueAt = (record: string[], column: string) => record[indexByName.get(column) ?? -1] ?? "";

  const parsed = records
    .map((record): CsvRow => ({
      name: valueAt(record, "Project Name").trim(),
      domain: normalizeDomain(valueAt(record, "Domain")),
      repoName: valueAt(record, "GitHub Repo").trim() || null,
      productType: valueAt(record, "Product Type").trim() || null,
      inventoryStatus: valueAt(record, "Status").trim() || null,
      notes: valueAt(record, "Notes").trim() || null,
    }))
    .filter((row) => row.name && row.domain && shouldInclude(row.inventoryStatus || "", row.notes || ""));

  return parsed as RebootSeedProject[];
}

export async function rebootInventoryAvailable() {
  const path = process.env.REBOOT_PROJECT_INVENTORY_PATH?.trim() || "/Users/miguel/Reboot/PROJECT_MASTER_LIST.csv";
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getRebootSeedProjects() {
  const local = await readLocalRebootCsv();
  if (local?.length) return local;
  return rebootSeed;
}

