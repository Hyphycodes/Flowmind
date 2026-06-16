import {
  pipelineSchema,
  runTraceSchema,
  takeSchema,
  type HandoffPacket,
  type OutputTable,
  type Pipeline,
  type RunTrace,
  type Take,
} from "./schema";
import type { EvalResult } from "@/lib/evals/schema";
import { datasetSchema, type Dataset } from "@/lib/datasets/schema";

const P = (raw: unknown): Pipeline => pipelineSchema.parse(raw);
const R = (raw: unknown): RunTrace => runTraceSchema.parse(raw);
const ISO = (min: number) => new Date(Date.now() - min * 60000).toISOString();

export type TeamTemplate = {
  id: string;
  label: string;
  blurb: string;
  keywords: string[];
  pipeline: Pipeline;
  exampleRun: RunTrace;
  takes?: Take[];
};

/** Build a deterministic EvalResult from dimension→score pairs. */
function evalResult(nodeId: string, summary: string, pairs: [string, number][]): EvalResult {
  const scores = pairs.map(([dimension, score]) => ({ dimension, score }));
  const overall = Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length);
  return { nodeId, overall, verdict: overall >= 75 ? "pass" : overall >= 50 ? "warn" : "fail", scores, summary };
}

/* ════════════════ Research Intelligence Crew (teams + packets) ════════════════ */

/** Reusable Input Studio dataset for the Source Team — "Market Signal Sources v1".
 *  A deliberate Seed Dataset (NOT mock junk) with research-source fields. One row
 *  leaves `credibility_notes` empty so the missing-value + contract utilities have
 *  something real to surface; the Source Team provides `credibility_notes` while the
 *  next team expects `credibility`, demonstrating a field mapping + contract warning. */
export const RESEARCH_SOURCES_DATASET: Dataset = datasetSchema.parse({
  id: "ds-sources-seed",
  name: "Market Signal Sources v1",
  description: "Realistic candidate research sources on a market question, with credibility and relevance signals.",
  mode: "input_studio",
  sourcePrompt:
    "Generate realistic candidate research sources for a competitive market question, with fields similar to a sourcing tool's results.",
  qualityTarget: "high_quality",
  generationStyle: "api_like",
  scenarioTags: ["market_entry"],
  requiredFields: ["title", "publisher", "type", "credibility_notes", "relevance"],
  qualityScore: 90,
  schema: [
    { key: "title", label: "Source", type: "text" },
    { key: "type", label: "Type", type: "badge" },
    { key: "publisher", label: "Publisher", type: "text" },
    { key: "region", label: "Region", type: "text" },
    { key: "published", label: "Published", type: "date" },
    { key: "relevance", label: "Relevance", type: "number" },
    { key: "credibility_notes", label: "Credibility", type: "text" },
    { key: "access", label: "Access", type: "badge" },
    { key: "key_claim", label: "Key claim", type: "text" },
    { key: "tags", label: "Tags", type: "text" },
    { key: "cited_by", label: "Cited by", type: "number" },
    { key: "risk_notes", label: "Risk", type: "text" },
    { key: "source_confidence", label: "Confidence", type: "percent" },
  ],
  rows: [
    { title: "2026 SMB Workflow Automation Market Report", type: "Report", publisher: "Bridgepoint Research", region: "Global", published: "2026-03-01", relevance: 95, credibility_notes: "Established analyst firm, paid methodology", access: "paywall", key_claim: "Market consolidating around 3 incumbents; ~18% CAGR.", tags: "market-size, incumbents", cited_by: 42, risk_notes: "Vendor-funded sections", source_confidence: 92 },
    { title: "Vendor pricing teardown (n=6)", type: "Primary", publisher: "Self-collected", region: "US", published: "2026-05-12", relevance: 88, credibility_notes: "First-hand pricing pages, small sample", access: "open", key_claim: "Mid-market pricing compressed ~12% YoY.", tags: "pricing, primary", cited_by: 0, risk_notes: "Snapshot only", source_confidence: 84 },
    { title: "Analyst commentary: switching costs as moat", type: "Opinion", publisher: "Field Notes", region: "Global", published: "2026-04-20", relevance: 80, credibility_notes: "Experienced analyst, no data shown", access: "open", key_claim: "Switching costs are the primary defensible moat.", tags: "moat, strategy", cited_by: 9, risk_notes: "Opinion, not measured", source_confidence: 79 },
    { title: "Buyer survey: tooling fatigue", type: "Survey", publisher: "Cohort Labs", region: "US/EU", published: "2026-02-08", relevance: 86, credibility_notes: "n=412 buyers, methodology disclosed", access: "open", key_claim: "61% of buyers report tool-switching fatigue.", tags: "demand, survey", cited_by: 17, risk_notes: "Self-reported", source_confidence: 88 },
    { title: "Community forum threads (aggregated)", type: "Anecdote", publisher: "Various", region: "Global", published: "2026-05-29", relevance: 58, credibility_notes: "", access: "open", key_claim: "Users frustrated by long onboarding.", tags: "voice-of-customer", cited_by: 0, risk_notes: "Unverified, noisy", source_confidence: 52 },
    { title: "Incumbent 10-K segment disclosures", type: "Filing", publisher: "Public filings", region: "US", published: "2026-02-28", relevance: 90, credibility_notes: "Audited financials", access: "open", key_claim: "Top incumbent grew segment revenue 21% YoY.", tags: "financials, incumbents", cited_by: 31, risk_notes: "Segment definitions vary", source_confidence: 91 },
    { title: "Integration-depth case studies", type: "Case study", publisher: "Bridgepoint Research", region: "Global", published: "2026-01-19", relevance: 83, credibility_notes: "Curated wins, selection bias", access: "paywall", key_claim: "Deeper integrations correlate with lower churn.", tags: "retention, integration", cited_by: 14, risk_notes: "Cherry-picked", source_confidence: 80 },
    { title: "Pricing elasticity study, mid-market SaaS", type: "Report", publisher: "Helix Analytics", region: "US", published: "2026-04-02", relevance: 84, credibility_notes: "Regression-based, peer-reviewed", access: "paywall", key_claim: "Demand elasticity rises sharply above $40/seat.", tags: "pricing, elasticity", cited_by: 22, risk_notes: "US-centric", source_confidence: 86 },
    { title: "Founder interviews: GTM wedges", type: "Interview", publisher: "Self-collected", region: "Global", published: "2026-05-04", relevance: 76, credibility_notes: "8 founders, qualitative", access: "open", key_claim: "Integration depth beats price as a wedge.", tags: "gtm, qualitative", cited_by: 3, risk_notes: "Small qualitative sample", source_confidence: 74 },
    { title: "Churn benchmark dataset", type: "Dataset", publisher: "Cohort Labs", region: "Global", published: "2026-03-22", relevance: 82, credibility_notes: "Anonymized, large panel", access: "open", key_claim: "Median mid-market net churn improved 3pts YoY.", tags: "retention, benchmark", cited_by: 19, risk_notes: "Survivorship bias", source_confidence: 85 },
  ],
});

const RESEARCH_TABLES: OutputTable[] = [
  {
    id: "sources",
    name: "sources",
    sourceNodeId: "source-team",
    description: "Candidate sources gathered + enriched by the Source Team.",
    columns: RESEARCH_SOURCES_DATASET.schema,
    rows: RESEARCH_SOURCES_DATASET.rows,
  },
  {
    id: "analysis_profile",
    name: "analysis_profile",
    sourceNodeId: "analysis-team",
    description: "Compressed analysis direction from the Analysis Team council.",
    columns: [
      { key: "direction", label: "Direction", type: "text" },
      { key: "avoid", label: "Discount", type: "text" },
      { key: "prioritize", label: "Prioritize", type: "text" },
      { key: "confidence", label: "Confidence", type: "percent" },
    ],
    rows: [
      {
        direction: "differentiate on integration depth, not price",
        avoid: "vendor-funded claims, unverified anecdotes, US-only signals",
        prioritize: "audited financials, disclosed-methodology surveys, primary pricing",
        confidence: 86,
      },
    ],
  },
  {
    id: "ranked_sources",
    name: "ranked_sources",
    sourceNodeId: "scoring-team",
    description: "Top sources ranked by the Scoring Team vote.",
    columns: [
      { key: "rank", label: "#", type: "number" },
      { key: "title", label: "Source", type: "text" },
      { key: "score", label: "Score", type: "number" },
      { key: "relevance_match", label: "Relevance", type: "percent" },
      { key: "credibility_match", label: "Credibility", type: "percent" },
      { key: "bias_risk", label: "Bias", type: "badge" },
      { key: "why", label: "Why", type: "text" },
    ],
    rows: [
      { rank: 1, title: "Incumbent 10-K segment disclosures", score: 91, relevance_match: 90, credibility_match: 94, bias_risk: "low", why: "Audited financials directly on the question." },
      { rank: 2, title: "2026 SMB Workflow Automation Market Report", score: 88, relevance_match: 95, credibility_match: 82, bias_risk: "medium", why: "Strong market sizing; watch vendor-funded sections." },
      { rank: 3, title: "Buyer survey: tooling fatigue", score: 86, relevance_match: 86, credibility_match: 88, bias_risk: "low", why: "Disclosed methodology, sizable n." },
      { rank: 4, title: "Pricing elasticity study, mid-market SaaS", score: 84, relevance_match: 84, credibility_match: 86, bias_risk: "low", why: "Peer-reviewed pricing signal." },
      { rank: 5, title: "Vendor pricing teardown (n=6)", score: 82, relevance_match: 88, credibility_match: 80, bias_risk: "low", why: "Primary pricing; small sample." },
      { rank: 6, title: "Churn benchmark dataset", score: 80, relevance_match: 82, credibility_match: 85, bias_risk: "low", why: "Large panel; survivorship caveat." },
    ],
  },
  {
    id: "synthesis",
    name: "synthesis",
    sourceNodeId: "synthesis-team",
    description: "Structured synthesis from the Synthesis Team.",
    columns: [
      { key: "section", label: "Section", type: "text" },
      { key: "detail", label: "Detail", type: "text" },
      { key: "confidence", label: "Confidence", type: "badge" },
    ],
    rows: [
      { section: "Thesis", detail: "Differentiate on integration depth; the mid-market is fatigued by switching costs.", confidence: "High" },
      { section: "Evidence", detail: "Audited 10-K growth + disclosed-methodology buyer survey converge.", confidence: "High" },
      { section: "Risk", detail: "Incumbent bundling could erode the wedge within ~4 quarters.", confidence: "Medium" },
    ],
  },
  {
    id: "brief",
    name: "brief",
    sourceNodeId: "final-composer",
    description: "Final composed executive brief surface.",
    columns: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "summary", label: "Summary", type: "text" },
      { key: "recommendation", label: "Recommendation", type: "text" },
      { key: "confidence", label: "Confidence", type: "text" },
    ],
    rows: [
      {
        headline: "Win on integration depth, not on price",
        summary:
          "Across 6 high-credibility sources, the mid-market is consolidating around 3 incumbents with ~12% price compression and rising tool-switching fatigue. Audited financials and a disclosed-methodology survey converge on integration depth as the durable wedge.",
        recommendation: "Lead GTM with integration depth; treat price as table-stakes.",
        confidence: "Medium-High",
      },
    ],
  },
];

const team = (
  strategy: string,
  agents: { id: string; name: string; role: string; prompt: string; isLead?: boolean }[],
  lead?: string,
) => ({
  strategy,
  lead,
  agents: agents.map((a) => ({ ...a, model: "claude-sonnet-4-6" })),
  internalEdges: agents.slice(1).map((a) => ({ source: agents[0].id, target: a.id })),
});

export const researchCrewPipeline = P({
  id: "tpl-research-crew",
  name: "Research Intelligence Crew",
  description:
    "A multi-team research system: Source → Analysis → Scoring → Synthesis → Composer. The canvas shows departments; each Team Node opens a Crew Room and hands off a slim packet.",
  datasetIds: ["ds-sources-seed"],
  scenarioSets: [
    { id: "sc-market-entry", name: "Market entry call", tag: "market_entry", description: "Should we enter this market, and how do we win?", prompt: "competitive position for a mid-market SaaS in 2026", datasetIds: ["ds-sources-seed"] },
    { id: "sc-pricing", name: "Pricing review", tag: "pricing", description: "Pressure-test pricing against the market.", prompt: "mid-market SaaS pricing pressure in 2026", datasetIds: [] },
  ],
  blueprint: {
    name: "Research Intelligence Crew",
    pitch: "Ask a market question; a crew sources, weighs, scores, and composes an executive brief.",
    targetUser: "Founders, strategy, and analysts who need a sourced answer fast.",
    vibeTags: ["rigorous", "sourced", "fast"],
    coreValue: "Turns a vague question into a sourced, credibility-weighted brief.",
    workflowSummary: "Source candidates → analyze + weigh → score + rank → synthesize → compose brief.",
    keyDataObjects: ["sources", "analysis_profile", "ranked_sources", "synthesis", "brief"],
    uiSurfaces: ["Ranked sources grid", "Executive brief card", "Synthesis outline"],
    missingApis: ["Web search (live)", "Academic / filings APIs", "Citation graph"],
    fastestMvpPath: "Use Input Studio sources + manual links; wire live search later.",
    monetization: "Per-seat for analysts; usage-based on sourced briefs.",
  },
  realityMeter: {
    buildability: 74,
    missing: ["Live web search", "Filings/academic APIs", "Citation graph"],
    hardestPart: "Reliable, de-duplicated source retrieval with credibility signals.",
    fastestMvpPath: "Input Studio seed sources → live search for one domain.",
    costRisk: "medium",
    complexityRisk: "high",
    dataQualityRisk: "medium",
    recommendedNext: "Wire live search for the Source Team, keep the rest mocked.",
    fakeFirst: ["source retrieval", "credibility scores"],
    automateLater: ["citation graph", "auto-refresh"],
  },
  nodes: [
    {
      id: "input",
      type: "input",
      layer: "source",
      title: "Brief",
      subtitle: "Question + constraints",
      description: "The research question, scope, and constraints.",
      color: "cyan",
      outputs: ["brief_in"],
      position: { x: 40, y: 180 },
    },
    {
      id: "source-team",
      type: "tool",
      layer: "source",
      title: "Source Team",
      subtitle: "Gather candidates",
      description: "Collects + enriches candidate sources (Input Studio or live search).",
      color: "blue",
      outputs: ["sources"],
      position: { x: 40, y: 460 },
      source: {
        mode: "input_studio",
        datasetId: "ds-sources-seed",
        prompt: "20 realistic candidate sources for a market question",
        rowCount: 20,
      },
      team: team(
        "parallel",
        [
          { id: "collector", name: "Collector", role: "Source collector", prompt: "Pull candidate sources with title, type, publisher, region, date, key claim.", isLead: true },
          { id: "enricher", name: "Enricher", role: "Detail enricher", prompt: "Add credibility notes, access, and relevance to each source." },
        ],
        "collector",
      ),
    },
    {
      id: "analysis-team",
      type: "agent",
      layer: "brain",
      title: "Analysis Team",
      subtitle: "Weigh the evidence",
      description: "A council that compresses the question into a slim analysis direction.",
      color: "violet",
      inputs: ["brief_in", "sources"],
      outputs: ["analysis_profile"],
      position: { x: 380, y: 300 },
      team: team(
        "council",
        [
          { id: "chair", name: "Chair", role: "Synthesizer", prompt: "Compress the council's views into one analysis direction.", isLead: true },
          { id: "domain-analyst", name: "Domain Analyst", role: "Domain expert", prompt: "Infer what the question really needs answered." },
          { id: "signal-reader", name: "Signal Reader", role: "Evidence reader", prompt: "Judge which signals are strong vs. weak." },
          { id: "bias-detector", name: "Bias Detector", role: "Evidence guardrail", prompt: "Flag vendor-funded / unverified / selection-bias risk." },
        ],
        "chair",
      ),
    },
    {
      id: "scoring-team",
      type: "evaluator",
      layer: "brain",
      title: "Scoring Team",
      subtitle: "Score + vote",
      description: "Independent scorers vote; an aggregator merges into a ranking.",
      color: "gold",
      inputs: ["sources", "analysis_profile"],
      outputs: ["ranked_sources"],
      position: { x: 700, y: 300 },
      evalDimensions: ["relevance_match", "credibility_match", "bias_risk", "recency", "coverage"],
      team: team(
        "vote",
        [
          { id: "aggregator", name: "Aggregator", role: "Vote aggregator", prompt: "Merge scorer votes into a ranked list with reasons.", isLead: true },
          { id: "scorer-relevance", name: "Relevance Scorer", role: "Relevance", prompt: "Score how directly each source answers the question." },
          { id: "scorer-credibility", name: "Credibility Scorer", role: "Credibility", prompt: "Score source credibility and methodology." },
          { id: "scorer-recency", name: "Recency Scorer", role: "Recency", prompt: "Score freshness and ongoing relevance." },
        ],
        "aggregator",
      ),
    },
    {
      id: "synthesis-team",
      type: "agent",
      layer: "brain",
      title: "Synthesis Team",
      subtitle: "Build the thesis",
      description: "Outlines, then writes a structured synthesis from the top sources.",
      color: "teal",
      inputs: ["ranked_sources"],
      outputs: ["synthesis"],
      position: { x: 1020, y: 180 },
      team: team(
        "sequential",
        [
          { id: "outliner", name: "Outliner", role: "Synthesis outliner", prompt: "Outline thesis, evidence, and risk from the ranked sources." },
          { id: "writer", name: "Writer", role: "Synthesis writer", prompt: "Write each section with confidence levels.", isLead: true },
        ],
        "writer",
      ),
    },
    {
      id: "final-composer",
      type: "output",
      layer: "surface",
      title: "Final Composer",
      subtitle: "Compose the brief",
      description: "Composes the executive brief surface + UI cards.",
      color: "pink",
      inputs: ["ranked_sources", "synthesis", "analysis_profile"],
      outputs: ["brief"],
      position: { x: 1020, y: 460 },
      team: team("single", [
        { id: "composer", name: "Composer", role: "Brief writer", prompt: "Write a confident, sourced executive brief using the synthesis + top sources.", isLead: true },
      ]),
    },
  ],
  edges: [
    { id: "je1", source: "input", target: "analysis-team", dataKey: "brief_in" },
    {
      id: "je2",
      source: "source-team",
      target: "analysis-team",
      dataKey: "sources",
      label: "sources",
      packetId: "pkt_source",
      contract: {
        provides: [
          { key: "title", type: "string", required: true },
          { key: "publisher", type: "string", required: true },
          { key: "relevance", type: "number", required: true },
          { key: "type", type: "string", required: true },
          { key: "credibility_notes", type: "string", required: false },
        ],
        expects: [
          { key: "title", type: "string", required: false },
          { key: "publisher", type: "string", required: false },
          { key: "relevance", type: "number", required: false },
          { key: "type", type: "string", required: false },
          { key: "credibility", type: "string", required: true },
        ],
        status: "warning",
        warnings: [
          {
            severity: "warning",
            field: "credibility",
            message: "Source provides `credibility_notes` but the Analysis Team expects `credibility`. Apply the suggested mapping.",
          },
        ],
      },
    },
    { id: "je3", source: "source-team", target: "scoring-team", dataKey: "sources" },
    { id: "je4", source: "analysis-team", target: "scoring-team", dataKey: "analysis_profile", label: "analysis_profile", packetId: "pkt_analysis" },
    { id: "je5", source: "scoring-team", target: "synthesis-team", dataKey: "ranked_sources", label: "ranked_sources", packetId: "pkt_scoring" },
    { id: "je6", source: "scoring-team", target: "final-composer", dataKey: "ranked_sources" },
    { id: "je7", source: "synthesis-team", target: "final-composer", dataKey: "synthesis", label: "synthesis", packetId: "pkt_synthesis" },
    { id: "je8", source: "analysis-team", target: "final-composer", dataKey: "analysis_profile" },
  ],
  mockInputs: [
    { key: "question", label: "Question", value: "How should a mid-market SaaS position against consolidating incumbents in 2026?" },
    { key: "scope", label: "Scope", value: "US + EU, last 12 months" },
    { key: "depth", label: "Depth", value: "Executive brief" },
    { key: "deadline", label: "Deadline", value: "Today" },
  ],
  outputTables: RESEARCH_TABLES,
  uiBindings: [
    { id: "rb-ranked", tableId: "ranked_sources", componentType: "recommendationCards", title: "Top Sources", position: 0, fields: ["title", "score", "why"] },
    { id: "rb-brief", tableId: "brief", componentType: "summaryCard", title: "Executive Brief", position: 1, fields: ["headline", "summary"] },
    { id: "rb-synth", tableId: "synthesis", componentType: "timeline", title: "Synthesis", position: 2, fields: ["section", "detail", "confidence"] },
    { id: "rb-analysis", tableId: "analysis_profile", componentType: "summaryCard", title: "Analysis Direction", position: 3, fields: ["direction", "prioritize"] },
  ],
});

const RESEARCH_PACKETS: HandoffPacket[] = [
  {
    packetId: "pkt_source",
    fromNodeId: "source-team",
    toNodeId: "analysis-team",
    summary: "9 candidate sources collected and enriched with type, credibility notes, and relevance.",
    keyFields: { count: 9, types: ["Report", "Survey", "Filing"], region_coverage: "US + EU + Global", credibility_scored: true },
    confidence: 0.9,
    assumptions: ["Question is competitive positioning."],
    missingData: ["Live web results."],
    warnings: [],
    sourceReferences: ["ds-sources-seed"],
    fieldChanges: { added: ["relevance", "credibility", "access"], compressed: ["raw_source_text"], dropped: [] },
    nextAction: "Weigh the evidence and set an analysis direction.",
  },
  {
    packetId: "pkt_analysis",
    fromNodeId: "analysis-team",
    toNodeId: "scoring-team",
    summary: "Prioritize audited/disclosed-methodology sources; discount vendor-funded and unverified signals.",
    keyFields: { direction: "integration depth, not price", discount: ["vendor-funded", "unverified anecdotes", "US-only"], prioritize: ["audited financials", "disclosed-methodology surveys", "primary pricing"] },
    confidence: 0.86,
    assumptions: ["Decision horizon is ~4 quarters."],
    missingData: ["EU-specific pricing depth."],
    warnings: ["Some signals are US-centric."],
    sourceReferences: ["brief_in", "sources"],
    fieldChanges: { added: ["direction", "discount"], compressed: ["raw_source_text"], dropped: [] },
    nextAction: "Score + rank sources against this analysis direction.",
  },
  {
    packetId: "pkt_scoring",
    fromNodeId: "scoring-team",
    toNodeId: "synthesis-team",
    summary: "Top 6 ranked by relevance + credibility; the 10-K disclosures lead. (Note: access tier not carried forward.)",
    keyFields: { top_source: "Incumbent 10-K segment disclosures", avg_score: 85, count: 6 },
    confidence: 0.82,
    assumptions: [],
    missingData: [],
    warnings: ["Two top sources are paywalled."],
    sourceReferences: ["sources", "analysis_profile"],
    fieldChanges: { added: ["score", "relevance_match", "credibility_match"], compressed: ["per_scorer_votes"], dropped: [] },
    nextAction: "Synthesize a thesis from the top sources.",
  },
  {
    packetId: "pkt_synthesis",
    fromNodeId: "synthesis-team",
    toNodeId: "final-composer",
    summary: "Thesis: win on integration depth. Evidence converges; incumbent bundling is the main risk.",
    keyFields: { thesis: "integration depth over price", evidence_strength: "high", main_risk: "incumbent bundling" },
    confidence: 0.88,
    assumptions: ["Mid-market segment, 2026."],
    missingData: [],
    warnings: [],
    sourceReferences: ["ranked_sources"],
    fieldChanges: { added: ["thesis", "risk"], compressed: [], dropped: [] },
    nextAction: "Compose the final executive brief surface.",
  },
];

const researchCrewRun = R({
  id: "run-research-crew-example",
  pipelineId: "tpl-research-crew",
  status: "success",
  startedAt: ISO(6),
  finishedAt: ISO(4),
  costUsd: 0.071,
  latencyMs: 12800,
  steps: [
    { nodeId: "input", title: "Brief", status: "success", kind: "node", durationMs: 90, summary: "Loaded question + constraints." },
    { nodeId: "source-team", title: "Source Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 2600, confidence: 0.9, summary: "9 sources collected + enriched." },
    { nodeId: "analysis-team", title: "Analysis Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 3100, confidence: 0.86, summary: "Council compressed analysis → packet." },
    { nodeId: "scoring-team", title: "Scoring Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 2900, confidence: 0.82, summary: "Voted, ranked top 6." },
    { nodeId: "synthesis-team", title: "Synthesis Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 1700, confidence: 0.88, summary: "Outlined + wrote thesis." },
    { nodeId: "final-composer", title: "Final Composer", status: "success", kind: "team", model: "claude-opus-4-8", durationMs: 1400, summary: "Composed executive brief surface." },
  ],
  tables: RESEARCH_TABLES,
  packets: RESEARCH_PACKETS,
  finalOutput: {
    title: "Executive Brief",
    summary:
      "Win on integration depth, not price. Across 6 high-credibility sources the mid-market is consolidating around 3 incumbents with ~12% price compression and rising tool-switching fatigue; audited financials and a disclosed-methodology survey converge on integration depth as the durable wedge.",
    highlights: [
      { label: "Top Source", value: "10-K disclosures", accent: "violet" },
      { label: "Score", value: "91 / 100", accent: "gold" },
      { label: "Sources", value: "9", accent: "teal" },
      { label: "Bias Risk", value: "Low", accent: "green" },
      { label: "Confidence", value: "Med-High", accent: "pink" },
    ],
  },
});

/** Demo Takes for the Research Crew — run the same teams three ways and compare. */
const researchCrewModels: Record<string, string> = Object.fromEntries(
  researchCrewPipeline.nodes.map((n) => [n.id, n.model]),
);

function researchCrewTake(o: {
  id: string;
  name: string;
  description: string;
  status: Take["status"];
  costUsd: number;
  latencyMs: number;
  warningCount: number;
  ranking: [string, number][];
  overall: [string, number][];
  models?: Record<string, string>;
}): Take {
  const evalResults = [
    evalResult("scoring-team", "Scoring Team judged sources.", o.ranking),
    evalResult("__overall__", "Overall pipeline quality.", o.overall),
  ];
  const overallScore = evalResults.find((r) => r.nodeId === "__overall__")!.overall;
  return takeSchema.parse({
    id: o.id,
    pipelineId: "tpl-research-crew",
    name: o.name,
    description: o.description,
    mode: "hybrid",
    status: o.status,
    runTraceId: researchCrewRun.id,
    trace: { ...researchCrewRun, id: `${o.id}-trace`, mode: "hybrid", status: "success", costUsd: o.costUsd, latencyMs: o.latencyMs, evalResults },
    modelSelections: o.models ?? researchCrewModels,
    scores: Object.fromEntries(o.overall),
    evalResults,
    overallScore,
    costUsd: o.costUsd,
    latencyMs: o.latencyMs,
    warningCount: o.warningCount,
    notes: "",
  });
}

export const RESEARCH_CREW_TAKES: Take[] = [
  researchCrewTake({
    id: "take-research-balanced",
    name: "Take 01 — Balanced Sourcing",
    description: "Input Studio dataset + Claude reasoning; balanced relevance vs. credibility.",
    status: "warning",
    costUsd: 0.071,
    latencyMs: 12800,
    warningCount: 1,
    ranking: [["relevance_match", 88], ["credibility_match", 87], ["bias_risk", 86], ["recency", 82], ["coverage", 85]],
    overall: [["relevance_match", 88], ["credibility_match", 87], ["bias_risk", 86], ["actionability", 84], ["recency", 82], ["coverage", 85], ["rigor", 78], ["freshness", 80]],
  }),
  researchCrewTake({
    id: "take-research-rigorous",
    name: "Take 02 — More Rigorous",
    description: "Same dataset, credibility-biased ranking — higher rigor, fewer fresh signals.",
    status: "warning",
    costUsd: 0.094,
    latencyMs: 14100,
    warningCount: 2,
    ranking: [["relevance_match", 84], ["credibility_match", 94], ["bias_risk", 92], ["recency", 70], ["coverage", 80]],
    overall: [["relevance_match", 84], ["credibility_match", 94], ["bias_risk", 92], ["actionability", 82], ["recency", 70], ["coverage", 80], ["rigor", 95], ["freshness", 68]],
  }),
  researchCrewTake({
    id: "take-research-fast",
    name: "Take 03 — Fast Cheap Run",
    description: "Haiku for scorers — much cheaper + faster, slightly weaker reasoning.",
    status: "warning",
    costUsd: 0.011,
    latencyMs: 4900,
    warningCount: 3,
    models: Object.fromEntries(researchCrewPipeline.nodes.map((n) => [n.id, "claude-haiku-4-5-20251001"])),
    ranking: [["relevance_match", 78], ["credibility_match", 75], ["bias_risk", 82], ["recency", 79], ["coverage", 90]],
    overall: [["relevance_match", 78], ["credibility_match", 75], ["bias_risk", 82], ["actionability", 74], ["recency", 79], ["coverage", 90], ["rigor", 64], ["freshness", 70]],
  }),
];

/* ════════════════════════════ Meal Curator ════════════════════════════ */

const MEAL_TABLES: OutputTable[] = [
  {
    id: "recipes", name: "recipes", sourceNodeId: "recipe-finder",
    description: "Recipes matched to preferences + pantry.",
    columns: [
      { key: "name", label: "Recipe", type: "text" },
      { key: "cuisine", label: "Cuisine", type: "badge" },
      { key: "minutes", label: "Time", type: "number" },
      { key: "calories", label: "Cal", type: "number" },
    ],
    rows: [
      { name: "Miso Salmon Bowls", cuisine: "Japanese", minutes: 25, calories: 540 },
      { name: "Chickpea Shakshuka", cuisine: "Mediterranean", minutes: 30, calories: 430 },
      { name: "Sheet-Pan Chicken", cuisine: "American", minutes: 35, calories: 610 },
      { name: "Veg Green Curry", cuisine: "Thai", minutes: 28, calories: 480 },
      { name: "Turkey Lettuce Cups", cuisine: "Asian", minutes: 20, calories: 390 },
    ],
  },
  {
    id: "weekly_meal_plan", name: "weekly_meal_plan", sourceNodeId: "planner",
    description: "A balanced week of dinners.",
    columns: [
      { key: "day", label: "Day", type: "text" },
      { key: "meal", label: "Meal", type: "text" },
      { key: "calories", label: "Cal", type: "number" },
    ],
    rows: [
      { day: "Mon", meal: "Miso Salmon Bowls", calories: 540 },
      { day: "Tue", meal: "Chickpea Shakshuka", calories: 430 },
      { day: "Wed", meal: "Sheet-Pan Chicken", calories: 610 },
      { day: "Thu", meal: "Veg Green Curry", calories: 480 },
      { day: "Fri", meal: "Turkey Lettuce Cups", calories: 390 },
    ],
  },
  {
    id: "shopping_items", name: "shopping_items", sourceNodeId: "planner",
    description: "Consolidated shopping list.",
    columns: [
      { key: "item", label: "Item", type: "text" },
      { key: "qty", label: "Qty", type: "text" },
      { key: "aisle", label: "Aisle", type: "badge" },
    ],
    rows: [
      { item: "Salmon fillets", qty: "2", aisle: "Seafood" },
      { item: "Chickpeas", qty: "2 cans", aisle: "Canned" },
      { item: "Chicken thighs", qty: "1.5 lb", aisle: "Meat" },
      { item: "Green curry paste", qty: "1 jar", aisle: "International" },
      { item: "Butter lettuce", qty: "2 heads", aisle: "Produce" },
    ],
  },
];

export const mealPipeline = P({
  id: "tpl-meal",
  name: "Meal Curator",
  description: "Preferences + pantry → matched recipes → balanced weekly plan + shopping list.",
  nodes: [
    { id: "input", type: "input", layer: "source", title: "Preferences", subtitle: "Diet + pantry", description: "Diet, dislikes, pantry, calorie target.", color: "cyan", outputs: ["prefs"], position: { x: 40, y: 300 } },
    { id: "recipe-finder", type: "agent", layer: "brain", title: "Recipe Finder", subtitle: "Match recipes", description: "Find recipes matching prefs + pantry.", color: "violet", inputs: ["prefs"], outputs: ["recipes"], prompt: "Find 5 recipes matching the prefs with name, cuisine, minutes, calories.", position: { x: 360, y: 300 } },
    { id: "balancer", type: "evaluator", layer: "brain", title: "Nutrition Balancer", subtitle: "Balance the week", description: "Balance calories + variety.", color: "gold", inputs: ["recipes"], outputs: ["balanced"], prompt: "Balance the recipes across the week for calories and variety.", position: { x: 690, y: 300 } },
    { id: "planner", type: "output", layer: "surface", title: "Plan & List", subtitle: "Plan + shop", description: "Build the weekly plan + shopping list.", color: "pink", inputs: ["balanced"], outputs: ["weekly_meal_plan", "shopping_items"], prompt: "Build a weekly meal plan and a consolidated shopping list.", position: { x: 1020, y: 300 } },
  ],
  edges: [
    { id: "me1", source: "input", target: "recipe-finder", dataKey: "prefs" },
    { id: "me2", source: "recipe-finder", target: "balancer", dataKey: "recipes" },
    { id: "me3", source: "balancer", target: "planner", dataKey: "balanced" },
  ],
  mockInputs: [
    { key: "diet", label: "Diet", value: "high-protein, pescatarian-leaning" },
    { key: "calories", label: "Calorie target", value: "~500 / dinner" },
    { key: "pantry", label: "Pantry", value: "rice, olive oil, soy sauce, eggs" },
  ],
  outputTables: MEAL_TABLES,
  uiBindings: [
    { id: "mb-cal", tableId: "weekly_meal_plan", componentType: "calendar", title: "This Week", position: 0, fields: ["day", "meal", "calories"] },
    { id: "mb-shop", tableId: "shopping_items", componentType: "checklist", title: "Shopping List", position: 1, fields: ["item", "qty", "aisle"] },
    { id: "mb-rec", tableId: "recipes", componentType: "cardGrid", title: "Recipes", position: 2, fields: ["name", "cuisine", "minutes"] },
  ],
});

const mealRun = R({
  id: "run-meal-example",
  pipelineId: "tpl-meal",
  status: "success",
  startedAt: ISO(8),
  finishedAt: ISO(7),
  steps: [
    { nodeId: "input", title: "Preferences", status: "success", durationMs: 80, summary: "Loaded diet + pantry." },
    { nodeId: "recipe-finder", title: "Recipe Finder", status: "success", durationMs: 1500, summary: "Matched 5 recipes." },
    { nodeId: "balancer", title: "Nutrition Balancer", status: "success", durationMs: 900, summary: "Balanced ~490 cal avg." },
    { nodeId: "planner", title: "Plan & List", status: "success", durationMs: 1100, summary: "5-day plan + 5 items." },
  ],
  tables: MEAL_TABLES,
  finalOutput: {
    title: "Weekly Meal Plan",
    summary: "Five balanced dinners (~490 cal avg) with a 5-item shopping list, matched to a high-protein, pescatarian-leaning diet.",
    highlights: [
      { label: "Dinners", value: "5", accent: "violet" },
      { label: "Avg Calories", value: "490", accent: "teal" },
      { label: "Shopping Items", value: "5", accent: "green" },
    ],
  },
});

/* ════════════════════════════ AI Outfit Curator ════════════════════════════ */

const OUTFIT_TABLES: OutputTable[] = [
  {
    id: "outfit_sets", name: "outfit_sets", sourceNodeId: "composer",
    description: "Composed outfit sets for the occasion.",
    columns: [
      { key: "name", label: "Look", type: "text" },
      { key: "pieces", label: "Pieces", type: "text" },
      { key: "vibe", label: "Vibe", type: "badge" },
      { key: "price", label: "Est.", type: "currency" },
    ],
    rows: [
      { name: "Quiet Luxe", pieces: "Charcoal knit, tailored trouser, suede loafer", vibe: "refined", price: 420 },
      { name: "Soft Smart", pieces: "Ecru overshirt, straight denim, white leather sneaker", vibe: "relaxed", price: 295 },
      { name: "Evening Edge", pieces: "Black crewneck, pleated trouser, Chelsea boot", vibe: "sharp", price: 380 },
    ],
  },
  {
    id: "shopping_items", name: "shopping_items", sourceNodeId: "composer",
    description: "Pieces to buy / pull.",
    columns: [
      { key: "item", label: "Item", type: "text" },
      { key: "look", label: "Look", type: "badge" },
      { key: "price", label: "Price", type: "currency" },
    ],
    rows: [
      { item: "Charcoal merino knit", look: "Quiet Luxe", price: 140 },
      { item: "Tailored wool trouser", look: "Quiet Luxe", price: 180 },
      { item: "Ecru overshirt", look: "Soft Smart", price: 110 },
      { item: "Chelsea boot", look: "Evening Edge", price: 220 },
    ],
  },
];

export const outfitPipeline = P({
  id: "tpl-outfit",
  name: "AI Outfit Curator",
  description: "Occasion + vibe + budget → style profile → composed outfit sets + shopping list.",
  nodes: [
    { id: "input", type: "input", layer: "source", title: "Occasion", subtitle: "Vibe + budget", description: "Occasion, vibe, budget, sizes.", color: "cyan", outputs: ["brief"], position: { x: 40, y: 300 } },
    { id: "profiler", type: "agent", layer: "brain", title: "Style Profiler", subtitle: "Read the vibe", description: "Build a style profile from the brief.", color: "violet", inputs: ["brief"], outputs: ["style_profile"], prompt: "Infer a style profile (silhouette, palette, formality) from the brief.", position: { x: 360, y: 300 } },
    { id: "catalog", type: "tool", layer: "source", title: "Catalog Source", subtitle: "Pull pieces", description: "Pull candidate pieces (catalog or wardrobe).", color: "blue", inputs: ["style_profile"], outputs: ["pieces"], position: { x: 690, y: 300 }, source: { mode: "input_studio", prompt: "candidate clothing pieces with name, category, price", rowCount: 24 } },
    { id: "composer", type: "output", layer: "surface", title: "Outfit Composer", subtitle: "Compose looks", description: "Compose outfit sets + a shopping list.", color: "pink", inputs: ["style_profile", "pieces"], outputs: ["outfit_sets", "shopping_items"], prompt: "Compose 3 outfit sets within budget and a shopping list.", position: { x: 1020, y: 300 } },
  ],
  edges: [
    { id: "oe1", source: "input", target: "profiler", dataKey: "brief" },
    { id: "oe2", source: "profiler", target: "catalog", dataKey: "style_profile" },
    { id: "oe3", source: "catalog", target: "composer", dataKey: "pieces" },
    { id: "oe4", source: "profiler", target: "composer", dataKey: "style_profile" },
  ],
  mockInputs: [
    { key: "occasion", label: "Occasion", value: "dinner date, modern, not flashy" },
    { key: "budget", label: "Budget", value: "$400" },
    { key: "sizes", label: "Sizes", value: "M top, 32 waist, 10.5 shoe" },
  ],
  outputTables: OUTFIT_TABLES,
  uiBindings: [
    { id: "ob-sets", tableId: "outfit_sets", componentType: "cardGrid", title: "Looks", position: 0, fields: ["name", "pieces", "price"] },
    { id: "ob-shop", tableId: "shopping_items", componentType: "checklist", title: "Shopping List", position: 1, fields: ["item", "look", "price"] },
  ],
});

const outfitRun = R({
  id: "run-outfit-example",
  pipelineId: "tpl-outfit",
  status: "success",
  startedAt: ISO(10),
  finishedAt: ISO(9),
  steps: [
    { nodeId: "input", title: "Occasion", status: "success", durationMs: 80, summary: "Loaded occasion + budget." },
    { nodeId: "profiler", title: "Style Profiler", status: "success", durationMs: 1300, summary: "Refined, quiet palette." },
    { nodeId: "catalog", title: "Catalog Source", status: "success", durationMs: 1200, summary: "Pulled 24 candidate pieces." },
    { nodeId: "composer", title: "Outfit Composer", status: "success", durationMs: 1400, summary: "Composed 3 looks under budget." },
  ],
  tables: OUTFIT_TABLES,
  finalOutput: {
    title: "Outfit Sets",
    summary: "Three looks for a modern, not-flashy dinner date — 'Quiet Luxe' leads at ~$420, with a 4-item shopping list.",
    highlights: [
      { label: "Looks", value: "3", accent: "violet" },
      { label: "Top Pick", value: "Quiet Luxe", accent: "pink" },
      { label: "Est. Cost", value: "$420", accent: "green" },
    ],
  },
});

/* ──────────────────────────────── exports ─────────────────────────────────── */

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: "tpl-research-crew",
    label: "Research Intelligence Crew",
    blurb: "Teams of agents → handoff packets → a sourced executive brief.",
    keywords: ["research", "crew", "team", "sources", "analysis", "synthesis", "brief", "agents", "council", "market"],
    pipeline: researchCrewPipeline,
    exampleRun: researchCrewRun,
    takes: RESEARCH_CREW_TAKES,
  },
  {
    id: "tpl-meal",
    label: "Meal Curator",
    blurb: "Preferences → recipes → balanced weekly plan + shopping list.",
    keywords: ["meal", "recipe", "food", "diet", "nutrition", "grocery", "cook", "weekly plan"],
    pipeline: mealPipeline,
    exampleRun: mealRun,
  },
  {
    id: "tpl-outfit",
    label: "AI Outfit Curator",
    blurb: "Occasion + budget → style profile → outfit sets + shopping list.",
    keywords: ["outfit", "style", "fashion", "wardrobe", "clothes", "look", "shopping"],
    pipeline: outfitPipeline,
    exampleRun: outfitRun,
  },
];
