import test from "node:test";
import assert from "node:assert/strict";

const webResult = {
  analysisSummary: "A bounded summary",
  keywords: ["market"],
  queries: ["bounded query"],
  signals: Array.from({ length: 10 }, (_, index) => ({
    title: `Signal ${index + 1}`,
    url: null,
    summary: `Summary ${index + 1}`,
    publishedAt: null,
    relevanceScore: 70,
  })),
};

const proposalResult = {
  analysisSummary: "A bounded summary",
  keywords: ["market"],
  proposals: Array.from({ length: 6 }, (_, index) => ({
    variantIndex: index + 1,
    headline: `Draft ${index + 1}`,
    rationale: "A short synthetic rationale",
    linkedin: "Synthetic LinkedIn draft.",
    x: "Synthetic X draft.",
    crosspost: "Synthetic crosspost draft.",
  })),
};

test("research requests cap output, web tool calls, prompt context, and stored result counts", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const bodies = [];
  process.env.OPENAI_API_KEY = "synthetic-test-only";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    const output = bodies.length === 1 ? webResult : proposalResult;
    return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  });

  const { runRadarResearch } = await import("../src/lib/radar-research.ts");
  const result = await runRadarResearch({
    name: "Synthetic project",
    scanQuery: "q".repeat(2_000),
    notes: "n".repeat(4_000),
    domain: null,
  });

  assert.equal(bodies.length, 2, "one scan makes at most the two configured model requests");
  assert.equal(bodies[0].max_output_tokens, 1_600);
  assert.equal(bodies[0].max_tool_calls, 1);
  assert.equal(bodies[1].max_output_tokens, 1_800);
  assert.ok(bodies.every((body) => body.input.length < 5_000));
  assert.equal(result.signals.length, 6);
  assert.equal(result.proposals.length, 3);
});
