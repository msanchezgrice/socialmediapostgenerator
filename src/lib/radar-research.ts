import type { RadarPlatform } from "@/lib/types";

type RadarProjectContext = {
  name: string;
  domain?: string | null;
  productType?: string | null;
  notes?: string | null;
  scanQuery?: string | null;
  existingSummary?: string | null;
  existingKeywords?: string[];
};

export type RadarSignalCandidate = {
  sourceType: "domain" | "news" | "topic";
  title: string;
  url: string | null;
  summary: string;
  publishedAt: string | null;
  relevanceScore: number;
  metadata: Record<string, unknown>;
};

export type RadarProposalDraft = {
  variantIndex: number;
  headline: string;
  rationale: string;
  content: Record<RadarPlatform, string>;
};

export type RadarResearchResult = {
  analysisSummary: string;
  detectedKeywords: string[];
  queries: string[];
  signals: RadarSignalCandidate[];
  proposals: RadarProposalDraft[];
};

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "among",
  "and",
  "another",
  "around",
  "because",
  "being",
  "below",
  "between",
  "builder",
  "builders",
  "building",
  "company",
  "could",
  "daily",
  "does",
  "doing",
  "domain",
  "from",
  "have",
  "into",
  "just",
  "landing",
  "might",
  "more",
  "most",
  "need",
  "next",
  "only",
  "other",
  "over",
  "page",
  "pages",
  "project",
  "projects",
  "really",
  "should",
  "site",
  "some",
  "than",
  "that",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "through",
  "today",
  "tool",
  "tools",
  "using",
  "want",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeDomain(input: string | null | undefined) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;
}

function domainToUrl(domain: string | null | undefined) {
  const normalized = normalizeDomain(domain);
  return normalized ? `https://${normalized}` : null;
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(input: string) {
  return decodeHtmlEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractTag(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1] || "") : "";
}

function extractMeta(html: string, attr: "name" | "property", value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(regex);
  return match ? decodeHtmlEntities((match[1] || match[2] || "").trim()) : "";
}

function trimText(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function tokenize(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const cleaned = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ");
    for (const token of cleaned.split(/[\s-]+/)) {
      if (!token || token.length < 4 || /^\d+$/.test(token) || STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([token]) => token);
}

function rankSignal(text: string, keywords: string[]) {
  const haystack = text.toLowerCase();
  let score = 45;
  for (const keyword of keywords.slice(0, 8)) {
    if (haystack.includes(keyword.toLowerCase())) score += 8;
  }
  return Math.min(99, score);
}

function dedupeSignals(signals: RadarSignalCandidate[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.title.toLowerCase()}::${signal.url || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseRssItems(xml: string) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => {
    const title = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const link = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const description = item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    return {
      title: stripHtml(title),
      link: decodeHtmlEntities(link.trim()) || null,
      description: stripHtml(description),
      pubDate: pubDate ? new Date(pubDate).toISOString() : null,
    };
  });
}

async function safeFetchText(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "cache-control": "no-store",
        "user-agent": "Mozilla/5.0 (compatible; SocialRadarBot/1.0; +https://socialmediapostgenerator.app)",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchDomainSignal(project: RadarProjectContext, keywords: string[]) {
  const url = domainToUrl(project.domain);
  if (!url) return null;

  const html = await safeFetchText(url);
  if (!html) {
    return {
      analysisSummary: `I could not fetch ${url} during the last scan, so the current proposal set leans on the saved project context and recent topic signals.`,
      keywords,
      signal: {
        sourceType: "domain" as const,
        title: `${project.name} domain snapshot`,
        url,
        summary: `The latest scan could not load ${url}. Keep messaging anchored to the current offer, audience, and project notes until the site is reachable again.`,
        publishedAt: new Date().toISOString(),
        relevanceScore: 40,
        metadata: {
          fetchStatus: "unreachable",
        },
      },
    };
  }

  const title = extractTag(html, "title");
  const metaDescription = extractMeta(html, "name", "description") || extractMeta(html, "property", "og:description");
  const ogTitle = extractMeta(html, "property", "og:title");
  const headline = extractTag(html, "h1") || ogTitle || title || `${project.name} homepage`;
  const textSnippet = trimText(stripHtml(html).slice(0, 1800), 420);
  const nextKeywords = unique([...keywords, ...tokenize([title, metaDescription, headline, textSnippet]).slice(0, 8)]).slice(0, 12);
  const summaryBits = [
    headline ? `Current headline: ${headline}.` : "",
    metaDescription ? `Meta description: ${metaDescription}.` : "",
    textSnippet ? `Visible copy suggests: ${textSnippet}` : "",
  ].filter(Boolean);

  return {
    analysisSummary: trimText(
      summaryBits.join(" ").trim() ||
        `${project.name} has a live domain and the latest scan pulled enough homepage copy to shape project-specific messaging.`,
      480,
    ),
    keywords: nextKeywords,
    signal: {
      sourceType: "domain" as const,
      title: `${project.name} homepage scan`,
      url,
      summary: trimText(
        `${headline || project.name}. ${metaDescription || textSnippet || "The domain scan refreshed the current positioning and language for this project."}`,
        320,
      ),
      publishedAt: new Date().toISOString(),
      relevanceScore: 78,
      metadata: {
        title,
        headline,
        metaDescription,
      },
    },
  };
}

function buildNewsQueries(project: RadarProjectContext, keywords: string[]) {
  const domainLabel = normalizeDomain(project.domain)?.split(".")[0] ?? "";
  const base = unique(
    [
      project.scanQuery?.trim() || "",
      [project.name, project.productType].filter(Boolean).join(" "),
      [domainLabel, project.productType].filter(Boolean).join(" "),
      keywords.slice(0, 3).join(" "),
    ]
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  return base.slice(0, 3);
}

async function fetchNewsSignals(project: RadarProjectContext, queries: string[], keywords: string[]) {
  const responses = await Promise.all(
    queries.map(async (query) => {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const xml = await safeFetchText(rssUrl);
      if (!xml) return [];
      return parseRssItems(xml).map((item) => ({
        sourceType: "news" as const,
        title: item.title,
        url: item.link,
        summary: trimText(item.description || `${item.title} surfaced for ${project.name}.`, 280),
        publishedAt: item.pubDate,
        relevanceScore: rankSignal(`${item.title} ${item.description}`, keywords),
        metadata: {
          query,
        },
      }));
    }),
  );

  return dedupeSignals(responses.flat())
    .sort((left, right) => {
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      return right.relevanceScore - left.relevanceScore || rightTime - leftTime;
    })
    .slice(0, 6);
}

function heuristicSummary(project: RadarProjectContext, signals: RadarSignalCandidate[], keywords: string[]) {
  const topSignal = signals.find((signal) => signal.sourceType === "news") ?? signals[0];
  const keywordText = keywords.slice(0, 4).join(", ");
  const contextBits = [
    project.productType ? `${project.name} is positioned around ${project.productType}.` : `${project.name} now has enough context for daily social scanning.`,
    project.notes ? `Working notes: ${trimText(project.notes, 160)}` : "",
    topSignal ? `The strongest fresh signal is "${topSignal.title}".` : "No fresh news headline landed in the latest query set.",
    keywordText ? `The scan is currently anchored on ${keywordText}.` : "",
  ].filter(Boolean);

  return trimText(contextBits.join(" "), 420);
}

function trimPost(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildProposalDrafts(project: RadarProjectContext, signals: RadarSignalCandidate[], analysisSummary: string) {
  const projectUrl = domainToUrl(project.domain);
  const fallbackSignal = {
    title: `${project.name} operator update`,
    summary: analysisSummary,
  };
  const signalPool = [
    signals.find((entry) => entry.sourceType === "news"),
    signals.find((entry) => entry.sourceType === "domain"),
    signals[1],
  ]
    .filter(Boolean)
    .map((entry) => entry as RadarSignalCandidate);

  while (signalPool.length < 3) {
    signalPool.push({
      sourceType: "topic",
      title: fallbackSignal.title,
      url: projectUrl,
      summary: fallbackSignal.summary,
      publishedAt: new Date().toISOString(),
      relevanceScore: 60,
      metadata: {},
    });
  }

  return signalPool.slice(0, 3).map((signal, index) => {
    const linkSuffix = projectUrl ? ` ${projectUrl}` : "";
    const head = trimText(signal.title.replace(/\s*-\s*Google News$/i, ""), 90);
    const summary = trimText(signal.summary || analysisSummary, 170);
    const intent =
      index === 0
        ? "why this matters"
        : index === 1
          ? "what I’m noticing"
          : "the angle I’d ship next";

    return {
      variantIndex: index + 1,
      headline: head,
      rationale: `Option ${index + 1} leans into ${intent} using the freshest available project and news context.`,
      content: {
        linkedin: trimPost(
          [
            `I’m tracking ${head} because it directly affects how ${project.name} should talk to its market.`,
            `${summary}`,
            `My take: this is the kind of shift I’d use to sharpen positioning, landing-page copy, and the next distribution experiment for ${project.name}.${linkSuffix}`,
          ].join("\n\n"),
          1200,
        ),
        x: trimPost(
          `Watching ${head} for ${project.name}. ${summary} My angle: use this signal to sharpen positioning and ship a tighter distribution test.${linkSuffix}`,
          280,
        ),
        crosspost: trimPost(
          `Signal for ${project.name}: ${head}. ${summary} This is the narrative I’d turn into today’s short update.${linkSuffix}`,
          420,
        ),
      },
    };
  });
}

function extractOpenAiText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const chunks =
    payload.output
      ?.flatMap((entry) => entry.content ?? [])
      .map((entry) => (entry.type === "output_text" || entry.type === "text" ? entry.text ?? "" : ""))
      .filter(Boolean) ?? [];
  return chunks.join("\n").trim();
}

function parseJsonObject<T>(value: string) {
  const direct = value.trim();
  try {
    return JSON.parse(direct) as T;
  } catch {
    const start = direct.indexOf("{");
    const end = direct.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(direct.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function maybeGenerateWithOpenAi(input: {
  project: RadarProjectContext;
  signals: RadarSignalCandidate[];
  analysisSummary: string;
  keywords: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = [
    `You are generating daily social content proposals for the project "${input.project.name}".`,
    "Return JSON only.",
    'JSON shape: {"analysisSummary":"string","keywords":["string"],"proposals":[{"variantIndex":1,"headline":"string","rationale":"string","linkedin":"string","x":"string","crosspost":"string"}]}',
    "Generate exactly 3 proposals.",
    "Constraints:",
    "- LinkedIn should be 2-4 short paragraphs in first person singular.",
    "- X should be in first person singular and under 280 characters.",
    "- crosspost should work for Threads, Bluesky, or short-form reuse.",
    "- Keep the writing specific to the project and the supplied signals.",
    `Project type: ${input.project.productType || "unknown"}`,
    `Project notes: ${input.project.notes || "none"}`,
    `Current summary: ${input.analysisSummary}`,
    `Current keywords: ${input.keywords.join(", ") || "none"}`,
    `Signals: ${input.signals
      .slice(0, 5)
      .map((signal) => `- ${signal.title} | ${signal.summary}`)
      .join("\n") || "none"}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: prompt,
        temperature: 0.6,
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = extractOpenAiText(payload);
    if (!text) return null;

    const parsed = parseJsonObject<{
      analysisSummary?: string;
      keywords?: string[];
      proposals?: Array<{
        variantIndex?: number;
        headline?: string;
        rationale?: string;
        linkedin?: string;
        x?: string;
        crosspost?: string;
      }>;
    }>(text);
    if (!parsed?.proposals?.length) return null;

    const proposals = parsed.proposals.slice(0, 3).map((proposal, index) => ({
      variantIndex: proposal.variantIndex ?? index + 1,
      headline: trimText(proposal.headline || `Option ${index + 1}`, 90),
      rationale: trimText(proposal.rationale || `Daily option ${index + 1}.`, 180),
      content: {
        linkedin: trimPost(proposal.linkedin || "", 1200),
        x: trimPost(proposal.x || "", 280),
        crosspost: trimPost(proposal.crosspost || "", 420),
      },
    }));

    if (!proposals.every((proposal) => proposal.content.linkedin && proposal.content.x && proposal.content.crosspost)) {
      return null;
    }

    return {
      analysisSummary: trimText(parsed.analysisSummary || input.analysisSummary, 420),
      keywords: unique([...(parsed.keywords ?? []), ...input.keywords]).slice(0, 12),
      proposals,
    };
  } catch {
    return null;
  }
}

export async function runRadarResearch(project: RadarProjectContext): Promise<RadarResearchResult> {
  const baseKeywords = unique(tokenize([project.name, project.productType, project.notes, project.existingSummary]).slice(0, 8));
  const domainResult = await fetchDomainSignal(project, baseKeywords);
  const detectedKeywords = unique([...(project.existingKeywords ?? []), ...(domainResult?.keywords ?? []), ...baseKeywords]).slice(0, 12);
  const queries = buildNewsQueries(project, detectedKeywords);
  const newsSignals = await fetchNewsSignals(project, queries, detectedKeywords);
  const signals = dedupeSignals([...(domainResult?.signal ? [domainResult.signal] : []), ...newsSignals]).slice(0, 8);
  const analysisSummary = heuristicSummary(project, signals, detectedKeywords);

  const llm = await maybeGenerateWithOpenAi({
    project,
    signals,
    analysisSummary: domainResult?.analysisSummary || analysisSummary,
    keywords: detectedKeywords,
  });

  return {
    analysisSummary: llm?.analysisSummary || domainResult?.analysisSummary || analysisSummary,
    detectedKeywords: llm?.keywords || detectedKeywords,
    queries,
    signals,
    proposals: llm?.proposals || buildProposalDrafts(project, signals, analysisSummary),
  };
}

