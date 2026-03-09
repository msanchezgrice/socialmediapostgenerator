import type { XHandleSuggestion } from "@/lib/types";

type XHandleContext = {
  name: string;
  domain?: string | null;
  repoName?: string | null;
  productType?: string | null;
  existingHandle?: string | null;
};

const X_HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const RESERVED_TOKENS = ["twitter", "admin"];

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function splitWords(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function collapse(value: string | null | undefined) {
  return splitWords(value).join("");
}

function normalizeDomainLabel(domain: string | null | undefined) {
  const trimmed = String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "");
  if (!trimmed) return "";
  return trimmed.split(".")[0] || "";
}

function acronym(words: string[]) {
  return words.map((word) => word[0] || "").join("");
}

function trimCandidate(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);
}

function extractExistingHandle(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const direct = trimmed.replace(/^@+/, "");
  if (X_HANDLE_PATTERN.test(direct)) return direct.toLowerCase();

  const match = trimmed.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})(?:\/|$)/i);
  if (match?.[1]) return match[1].toLowerCase();

  return trimCandidate(trimmed);
}

function validateHandle(handle: string) {
  if (!handle) return "Handle is empty.";
  if (!X_HANDLE_PATTERN.test(handle)) return "X handles must be 1-15 characters using letters, numbers, or underscores.";
  if (RESERVED_TOKENS.some((token) => handle.includes(token))) return 'Handles containing "twitter" or "admin" are not claimable on X.';
  return null;
}

function candidatePool(context: XHandleContext) {
  const words = splitWords(context.name);
  const domainLabel = normalizeDomainLabel(context.domain);
  const repo = collapse(context.repoName);
  const base = collapse(context.name) || domainLabel || repo;
  const shortAcronym = acronym(words);
  const tail = words.slice(1).join("");
  const existingHandle = extractExistingHandle(context.existingHandle);

  const raw = [
    existingHandle,
    base,
    domainLabel,
    repo,
    `${base}app`,
    `${base}hq`,
    `${base}ai`,
    `${base}_hq`,
    `${base}_app`,
    `${base}labs`,
    `${base}co`,
    `${base}io`,
    `${base}now`,
    `get${base}`,
    `use${base}`,
    `try${base}`,
    shortAcronym ? `${shortAcronym}${tail}` : "",
    shortAcronym ? `${shortAcronym}${domainLabel}` : "",
    shortAcronym ? `${shortAcronym}_${tail}` : "",
    words.length >= 2 ? `${words[0]}${words[1]}` : "",
    words.length >= 2 ? `${words[0]}_${words[1]}` : "",
    context.productType ? `${base}${collapse(context.productType).slice(0, Math.max(0, 15 - base.length))}` : "",
  ];

  return unique(
    raw
      .map(trimCandidate)
      .filter(Boolean)
      .filter((value) => value.length >= 4)
      .slice(0, 24),
  );
}

async function lookupTakenHandles(handles: string[]) {
  const token = process.env.X_BEARER_TOKEN?.trim() || process.env.TWITTER_BEARER_TOKEN?.trim() || "";
  if (!token || !handles.length) {
    return {
      checkedWithXApi: false,
      taken: new Set<string>(),
      errorReason: token ? null : "Set X_BEARER_TOKEN to run live X handle checks.",
    };
  }

  try {
    const url = `https://api.x.com/2/users/by?usernames=${encodeURIComponent(handles.join(","))}`;
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        checkedWithXApi: false,
        taken: new Set<string>(),
        errorReason: `X lookup failed with ${response.status}.`,
      };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      data?: Array<{ username?: string }>;
    };
    const taken = new Set(
      (payload.data ?? [])
        .map((entry) => String(entry.username || "").toLowerCase())
        .filter(Boolean),
    );

    return {
      checkedWithXApi: true,
      taken,
      errorReason: null,
    };
  } catch {
    return {
      checkedWithXApi: false,
      taken: new Set<string>(),
      errorReason: "X lookup request failed.",
    };
  }
}

export async function suggestXHandles(context: XHandleContext): Promise<{ suggestions: XHandleSuggestion[]; checkedWithXApi: boolean; note: string }> {
  const handles = candidatePool(context);
  const { checkedWithXApi, taken, errorReason } = await lookupTakenHandles(handles);

  const suggestions = handles.slice(0, 10).map((handle): XHandleSuggestion => {
    const invalidReason = validateHandle(handle);
    if (invalidReason) {
      return {
        handle,
        availability: "invalid",
        reason: invalidReason,
        profileUrl: null,
      };
    }

    if (taken.has(handle.toLowerCase())) {
      return {
        handle,
        availability: "taken",
        reason: "An active X profile already resolves for this handle.",
        profileUrl: `https://x.com/${handle}`,
      };
    }

    if (!checkedWithXApi) {
      return {
        handle,
        availability: "unchecked",
        reason: errorReason || "Generated from project metadata, but not checked against X yet.",
        profileUrl: null,
      };
    }

    return {
      handle,
      availability: "likely_available",
      reason: "No active X profile resolved for this handle. X can still block suspended, deactivated, or reserved usernames at claim time.",
      profileUrl: null,
    };
  });

  return {
    suggestions,
    checkedWithXApi,
    note: checkedWithXApi
      ? "Taken handles are confirmed via X user lookup. Likely-available handles still need a real X signup attempt because reserved or suspended usernames can fail."
      : errorReason || "Suggestions are generated locally. Add X_BEARER_TOKEN to enable live X availability checks.",
  };
}
