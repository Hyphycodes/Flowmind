import {
  pipelineSchema,
  runTraceSchema,
  type OutputTable,
  type Pipeline,
  type RunTrace,
  type Take,
} from "./schema";
import type { Dataset } from "@/lib/datasets/schema";
import { newId } from "./validate";
import { JARVIS_PLACES_DATASET, TEAM_TEMPLATES } from "./teamFixtures";

/** Reusable Seed Datasets bundled with the app (shown in the Dataset Library). */
export const FIXTURE_DATASETS: Dataset[] = [JARVIS_PLACES_DATASET];

const P = (raw: unknown): Pipeline => pipelineSchema.parse(raw);
const R = (raw: unknown): RunTrace => runTraceSchema.parse(raw);

const ISO = (min: number) => new Date(Date.now() - min * 60000).toISOString();

/* ───────────────────────── Real Estate Deal Analyzer ───────────────────────── */

const RE_TABLES: OutputTable[] = [
  {
    id: "comps",
    name: "comps",
    sourceNodeId: "comp-finder",
    description: "Comparable recent sales near the subject property.",
    columns: [
      { key: "address", label: "Address", type: "text" },
      { key: "beds", label: "Beds", type: "number" },
      { key: "baths", label: "Baths", type: "number" },
      { key: "sqft", label: "Sq Ft", type: "number" },
      { key: "sold_price", label: "Sold", type: "currency" },
      { key: "sold_date", label: "Date", type: "date" },
      { key: "dist", label: "Dist.", type: "text" },
    ],
    rows: [
      { address: "1719 W Mariposa St", beds: 3, baths: 2, sqft: 1450, sold_price: 283500, sold_date: "2026-05-15", dist: "0.3 mi" },
      { address: "1512 W Berridge Ln", beds: 3, baths: 2, sqft: 1480, sold_price: 289000, sold_date: "2026-04-18", dist: "0.4 mi" },
      { address: "1604 W Glenrosa Ave", beds: 3, baths: 1.75, sqft: 1395, sold_price: 274000, sold_date: "2026-05-02", dist: "0.7 mi" },
      { address: "1338 W Hazelwood St", beds: 3, baths: 2, sqft: 1520, sold_price: 296500, sold_date: "2026-03-29", dist: "0.6 mi" },
      { address: "1247 W Campbell Ave", beds: 4, baths: 2, sqft: 1610, sold_price: 305000, sold_date: "2026-04-05", dist: "0.9 mi" },
    ],
  },
  {
    id: "arv_estimate",
    name: "arv_estimate",
    sourceNodeId: "arv-estimator",
    description: "After-Repair Value range from comps + condition.",
    columns: [
      { key: "estimate", label: "Estimate", type: "text" },
      { key: "low", label: "Low", type: "currency" },
      { key: "expected", label: "Expected", type: "currency" },
      { key: "high", label: "High", type: "currency" },
      { key: "confidence", label: "Confidence", type: "badge" },
    ],
    rows: [
      { estimate: "After-Repair Value", low: 272000, expected: 285000, high: 298000, confidence: "High" },
    ],
  },
  {
    id: "repair_costs",
    name: "repair_costs",
    sourceNodeId: "repair-estimator",
    description: "Line-item rehab budget at market rates.",
    columns: [
      { key: "category", label: "Category", type: "text" },
      { key: "scope", label: "Scope", type: "text" },
      { key: "cost", label: "Cost", type: "currency" },
    ],
    rows: [
      { category: "Roof", scope: "Partial tear-off + patch", cost: 7800 },
      { category: "Kitchen", scope: "Cabinets, counters, appliances", cost: 12400 },
      { category: "Bathrooms", scope: "2 full remodels", cost: 8200 },
      { category: "Flooring", scope: "LVP throughout 1,450 sqft", cost: 6100 },
      { category: "Interior Paint", scope: "Walls, trim, ceilings", cost: 3400 },
      { category: "HVAC", scope: "Service + new condenser", cost: 4300 },
      { category: "Landscaping", scope: "Front + back cleanup", cost: 2350 },
      { category: "Contingency", scope: "10% buffer", cost: 4200 },
    ],
  },
  {
    id: "deal_score",
    name: "deal_score",
    sourceNodeId: "deal-scorer",
    description: "Composite score, grade, and max allowable offer.",
    columns: [
      { key: "grade", label: "Grade", type: "badge" },
      { key: "score", label: "Score", type: "text" },
      { key: "max_offer", label: "Max Offer", type: "currency" },
      { key: "margin", label: "Margin", type: "currency" },
      { key: "recommendation", label: "Call", type: "badge" },
    ],
    rows: [
      { grade: "A-", score: "82 / 100", max_offer: 172500, margin: 63750, recommendation: "Pursue" },
    ],
  },
  {
    id: "buyer_pitch",
    name: "buyer_pitch",
    sourceNodeId: "buyer-pitch",
    description: "One-paragraph pitch for the dispo board.",
    columns: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "summary", label: "Summary", type: "text" },
    ],
    rows: [
      {
        headline: "Turn-key value-add in a tightening Phoenix submarket",
        summary:
          "3/2 in 85015 with strong comps within 0.5 mi. $48.7k cosmetic-to-moderate rehab unlocks a $285k ARV. At a $172.5k max offer the deal holds a $63.7k margin with ~$1,250/mo cash-flow potential as a rental exit.",
      },
    ],
  },
  {
    id: "deal_summary",
    name: "deal_summary",
    sourceNodeId: "deal-scorer",
    description: "Headline numbers wired to the UI preview.",
    columns: [
      { key: "arv", label: "ARV", type: "currency" },
      { key: "repairs", label: "Repairs", type: "currency" },
      { key: "max_offer", label: "Max Offer", type: "currency" },
      { key: "cash_flow", label: "Cash Flow", type: "text" },
      { key: "score", label: "Score", type: "badge" },
    ],
    rows: [
      { arv: 285000, repairs: 48750, max_offer: 172500, cash_flow: "$1,250/mo", score: "A- (82/100)" },
    ],
  },
];

export const realEstatePipeline = P({
  id: "tpl-real-estate",
  name: "Real Estate Deal Analyzer",
  description:
    "Analyzes a property deal from address to comp analysis, ARV, repair estimate, deal score, and buyer pitch.",
  nodes: [
    {
      id: "input",
      type: "input",
      title: "Input",
      subtitle: "Property Details",
      description: "Collects the property address and basic details.",
      color: "blue",
      outputs: ["property_info"],
      position: { x: 40, y: 320 },
    },
    {
      id: "comp-finder",
      type: "agent",
      title: "Comp Finder",
      subtitle: "Find comparable properties",
      description: "Find comparable properties and return the 3–5 best matches.",
      role: "Real estate comparables analyst",
      prompt:
        "You are a real estate comps analyst. Given the subject property, return 3–5 of the best comparable recent sales. For each comp include address, beds, baths, sqft, sold_price, sold_date, and distance. Prefer sales within ~1 mile and the last 6 months and similar size/condition.",
      color: "teal",
      inputs: ["property_info"],
      outputs: ["comps"],
      position: { x: 330, y: 300 },
    },
    {
      id: "arv-estimator",
      type: "agent",
      title: "ARV Estimator",
      subtitle: "Estimate After-Repair Value",
      description: "Estimate After-Repair Value based on comps and property condition.",
      role: "Valuation analyst",
      prompt:
        "You are a valuation analyst. Using the comparable sales, estimate the After-Repair Value (ARV) of the subject property as a low / expected / high range with a confidence level. Reconcile $/sqft against the comps and note the basis.",
      color: "violet",
      inputs: ["comps", "property_info"],
      outputs: ["arv_estimate"],
      position: { x: 620, y: 330 },
    },
    {
      id: "repair-estimator",
      type: "agent",
      title: "Repair Estimator",
      subtitle: "Estimate repair costs",
      description: "Estimate repair costs based on property scope and market rates.",
      role: "Rehab estimator",
      prompt:
        "You are a rehab estimator. Produce a line-item repair budget (category, scope, cost) for a cosmetic-to-moderate flip at current market labor + material rates, including a contingency line. Keep the total realistic for the property size.",
      color: "orange",
      inputs: ["arv_estimate", "property_info"],
      outputs: ["repair_costs"],
      position: { x: 840, y: 110 },
    },
    {
      id: "deal-scorer",
      type: "evaluator",
      title: "Deal Scorer",
      subtitle: "Score the deal",
      description: "Score the deal based on metrics and thresholds.",
      role: "Acquisitions underwriter",
      prompt:
        "You are an acquisitions underwriter. Given ARV and repair costs, compute a max allowable offer (≈70% ARV − repairs), the resulting margin, a 0–100 deal score with a letter grade, and a pursue/pass recommendation. Also emit a compact deal_summary row (arv, repairs, max_offer, cash_flow, score).",
      color: "gold",
      inputs: ["arv_estimate", "repair_costs"],
      outputs: ["deal_score", "deal_summary"],
      position: { x: 1030, y: 330 },
    },
    {
      id: "buyer-pitch",
      type: "output",
      title: "Buyer Pitch Generator",
      subtitle: "Generate buyer pitch",
      description: "Generate a compelling buyer pitch with deal summary and highlights.",
      role: "Dispositions copywriter",
      prompt:
        "You are a dispositions copywriter. Write a tight, confident one-paragraph buyer pitch using the deal summary — lead with the opportunity, cite ARV, rehab, max offer, margin, and cash-flow, and close with the exit. Return a headline and summary.",
      color: "pink",
      inputs: ["deal_summary"],
      outputs: ["buyer_pitch"],
      position: { x: 840, y: 560 },
    },
  ],
  edges: [
    { id: "e1", source: "input", target: "comp-finder", dataKey: "property_info", animated: false },
    { id: "e2", source: "comp-finder", target: "arv-estimator", dataKey: "comps", animated: false },
    { id: "e3", source: "arv-estimator", target: "repair-estimator", dataKey: "arv_estimate", animated: false },
    { id: "e4", source: "arv-estimator", target: "deal-scorer", dataKey: "arv_estimate", animated: false },
    { id: "e5", source: "repair-estimator", target: "deal-scorer", dataKey: "repair_costs", animated: false },
    { id: "e6", source: "deal-scorer", target: "buyer-pitch", dataKey: "deal_summary", label: "deal_summary", animated: false },
  ],
  mockInputs: [
    { key: "address", label: "Property Address", value: "1429 W Mariposa St" },
    { key: "city", label: "City", value: "Phoenix" },
    { key: "state", label: "State", value: "AZ" },
    { key: "zip", label: "ZIP", value: "85015" },
    { key: "propertyType", label: "Property Type", value: "Single Family" },
  ],
  outputTables: RE_TABLES,
  uiBindings: [
    { id: "b-score", tableId: "deal_score", componentType: "summaryCard", title: "Deal Score", position: 0, fields: ["grade", "score", "recommendation"] },
    { id: "b-metrics", tableId: "deal_summary", componentType: "metricCards", title: "Key Numbers", position: 1, fields: ["arv", "repairs", "max_offer", "cash_flow"] },
    { id: "b-comps", tableId: "comps", componentType: "recordList", title: "Comparable Sales", position: 2, fields: ["address", "sold_price", "sqft", "sold_date"] },
    { id: "b-pitch", tableId: "buyer_pitch", componentType: "summaryCard", title: "Buyer Pitch", position: 3, fields: ["headline", "summary"] },
  ],
});

const realEstateRun = R({
  id: "run-real-estate-example",
  pipelineId: "tpl-real-estate",
  status: "success",
  startedAt: ISO(3),
  finishedAt: ISO(2),
  steps: [
    { nodeId: "input", title: "Input", status: "success", durationMs: 120, summary: "Loaded 1429 W Mariposa St, Phoenix AZ 85015." },
    { nodeId: "comp-finder", title: "Comp Finder", status: "success", durationMs: 2140, summary: "Found 5 comps within 0.9 mi, last 60 days." },
    { nodeId: "arv-estimator", title: "ARV Estimator", status: "success", durationMs: 1760, summary: "ARV ≈ $285,000 (high confidence)." },
    { nodeId: "repair-estimator", title: "Repair Estimator", status: "success", durationMs: 1980, summary: "Rehab budget $48,750 across 8 line items." },
    { nodeId: "deal-scorer", title: "Deal Scorer", status: "success", durationMs: 980, summary: "Score 82 (A-), max offer $172,500." },
    { nodeId: "buyer-pitch", title: "Buyer Pitch Generator", status: "success", durationMs: 1520, summary: "Drafted dispo-ready buyer pitch." },
  ],
  tables: RE_TABLES,
  finalOutput: {
    title: "Buyer Pitch",
    summary:
      "This value-add opportunity in Phoenix, AZ offers strong returns with manageable repair costs. With an ARV of $285,000 and total estimated costs of $172,500, the deal scores an A- with solid cash flow potential.",
    highlights: [
      { label: "ARV", value: "$285,000", accent: "violet" },
      { label: "Repair Costs", value: "$48,750", accent: "orange" },
      { label: "Max Offer", value: "$172,500", accent: "green" },
      { label: "Cash Flow (Est.)", value: "$1,250/mo", accent: "teal" },
      { label: "Deal Score", value: "A- (82/100)", accent: "gold" },
    ],
  },
});

/* ───────────────────────────── Content Repurposer ──────────────────────────── */

const C_TABLES: OutputTable[] = [
  {
    id: "hooks", name: "hooks", sourceNodeId: "hook-generator",
    description: "Scroll-stopping opening lines.",
    columns: [
      { key: "hook", label: "Hook", type: "text" },
      { key: "angle", label: "Angle", type: "text" },
      { key: "score", label: "Score", type: "number" },
    ],
    rows: [
      { hook: "Everyone's doing cold outreach wrong — here's the 3-line fix.", angle: "Contrarian", score: 92 },
      { hook: "I booked 14 calls last week with zero ad spend. The system:", angle: "Proof", score: 88 },
      { hook: "Stop writing follow-ups. Start writing this instead.", angle: "Pattern interrupt", score: 85 },
      { hook: "The 30-second audit that doubled our reply rate.", angle: "Quick win", score: 81 },
      { hook: "Your CRM is lying to you. Here's what to track instead.", angle: "Myth-bust", score: 79 },
    ],
  },
  {
    id: "scripts", name: "scripts", sourceNodeId: "script-writer",
    description: "Short-form video scripts by platform.",
    columns: [
      { key: "platform", label: "Platform", type: "badge" },
      { key: "length", label: "Length", type: "text" },
      { key: "script", label: "Script", type: "text" },
    ],
    rows: [
      { platform: "TikTok", length: "32s", script: "Hook → 3 quick proof points → one CTA. Fast cuts, captions on." },
      { platform: "Reels", length: "28s", script: "Open on result, rewind to method, end on 'save this'." },
      { platform: "Shorts", length: "45s", script: "Talking head + b-roll, single idea, hard CTA at 0:38." },
    ],
  },
  {
    id: "captions", name: "captions", sourceNodeId: "caption-writer",
    description: "On-brand captions + hashtags.",
    columns: [
      { key: "platform", label: "Platform", type: "badge" },
      { key: "caption", label: "Caption", type: "text" },
      { key: "hashtags", label: "Hashtags", type: "text" },
    ],
    rows: [
      { platform: "LinkedIn", caption: "We doubled reply rates by cutting our sequence in half. Here's the teardown.", hashtags: "#sales #gtm" },
      { platform: "Instagram", caption: "Less follow-up. More signal. Save this for your next campaign.", hashtags: "#marketing #founders" },
      { platform: "X", caption: "Your follow-ups are too long. Proof inside.", hashtags: "#startups" },
      { platform: "TikTok", caption: "The 3-line cold open that actually gets replies.", hashtags: "#salestok" },
    ],
  },
  {
    id: "posting_plan", name: "posting_plan", sourceNodeId: "posting-plan",
    description: "One week of scheduled assets.",
    columns: [
      { key: "day", label: "Day", type: "text" },
      { key: "platform", label: "Platform", type: "badge" },
      { key: "asset", label: "Asset", type: "text" },
      { key: "time", label: "Time", type: "text" },
    ],
    rows: [
      { day: "Mon", platform: "LinkedIn", asset: "Teardown carousel", time: "8:30a" },
      { day: "Tue", platform: "TikTok", asset: "32s hook video", time: "12:00p" },
      { day: "Wed", platform: "Instagram", asset: "Reel + caption", time: "6:00p" },
      { day: "Thu", platform: "X", asset: "Proof thread", time: "9:00a" },
      { day: "Fri", platform: "Shorts", asset: "45s explainer", time: "3:00p" },
    ],
  },
];

export const contentPipeline = P({
  id: "tpl-content",
  name: "Content Repurposer",
  description: "Turns one long-form idea into hooks, scripts, captions, and a week-long posting plan.",
  nodes: [
    { id: "input", type: "input", title: "Input", subtitle: "Transcript / Idea", description: "A long-form transcript or raw idea to repurpose.", color: "blue", outputs: ["source"], position: { x: 40, y: 320 } },
    { id: "angle-finder", type: "agent", title: "Angle Finder", subtitle: "Find the angles", description: "Extract the sharpest angles and themes worth posting.", role: "Content strategist", prompt: "Extract 3–5 distinct, postable angles from the source. For each, name the angle and the audience tension it speaks to.", color: "cyan", inputs: ["source"], outputs: ["angles"], position: { x: 330, y: 320 } },
    { id: "hook-generator", type: "agent", title: "Hook Generator", subtitle: "Write the hooks", description: "Generate scroll-stopping hooks scored by strength.", role: "Hook writer", prompt: "Write 5 scroll-stopping hooks. For each return hook, angle, and a 0–100 strength score.", color: "violet", inputs: ["angles"], outputs: ["hooks"], position: { x: 620, y: 300 } },
    { id: "script-writer", type: "agent", title: "Short Script Writer", subtitle: "Draft scripts", description: "Write short-form scripts per platform.", role: "Scriptwriter", prompt: "For TikTok, Reels, and Shorts, write a short script with platform, length, and the script beats.", color: "teal", inputs: ["hooks"], outputs: ["scripts"], position: { x: 910, y: 300 } },
    { id: "caption-writer", type: "agent", title: "Caption Writer", subtitle: "Write captions", description: "Write on-brand captions + hashtags.", role: "Copywriter", prompt: "Write platform-specific captions with hashtags that match the brand voice.", color: "green", inputs: ["hooks", "scripts"], outputs: ["captions"], position: { x: 910, y: 520 } },
    { id: "posting-plan", type: "output", title: "Posting Plan Generator", subtitle: "Schedule the week", description: "Assemble a one-week posting calendar.", role: "Social planner", prompt: "Build a one-week posting plan (day, platform, asset, time) from the scripts and captions.", color: "pink", inputs: ["scripts", "captions"], outputs: ["posting_plan"], position: { x: 1200, y: 410 } },
  ],
  edges: [
    { id: "e1", source: "input", target: "angle-finder", dataKey: "source" },
    { id: "e2", source: "angle-finder", target: "hook-generator", dataKey: "angles" },
    { id: "e3", source: "hook-generator", target: "script-writer", dataKey: "hooks" },
    { id: "e4", source: "hook-generator", target: "caption-writer", dataKey: "hooks" },
    { id: "e5", source: "script-writer", target: "posting-plan", dataKey: "scripts" },
    { id: "e6", source: "caption-writer", target: "posting-plan", dataKey: "captions" },
  ],
  mockInputs: [
    { key: "source", label: "Transcript / Idea", value: "Podcast clip on why shorter sales sequences convert better than long drip campaigns." },
    { key: "brand", label: "Brand Voice", value: "Direct, proof-driven, founder-to-founder" },
  ],
  outputTables: C_TABLES,
  uiBindings: [
    { id: "b-hooks", tableId: "hooks", componentType: "recordList", title: "Hook List", position: 0, fields: ["hook", "angle", "score"] },
    { id: "b-cal", tableId: "posting_plan", componentType: "recordList", title: "Content Calendar", position: 1, fields: ["day", "platform", "asset", "time"] },
    { id: "b-cap", tableId: "captions", componentType: "summaryCard", title: "Selected Caption", position: 2, fields: ["platform", "caption", "hashtags"] },
  ],
});

const contentRun = R({
  id: "run-content-example",
  pipelineId: "tpl-content",
  status: "success",
  startedAt: ISO(5),
  finishedAt: ISO(4),
  steps: [
    { nodeId: "input", title: "Input", status: "success", durationMs: 90, summary: "Loaded source transcript." },
    { nodeId: "angle-finder", title: "Angle Finder", status: "success", durationMs: 1450, summary: "Surfaced 4 angles." },
    { nodeId: "hook-generator", title: "Hook Generator", status: "success", durationMs: 1620, summary: "Wrote 5 hooks, top score 92." },
    { nodeId: "script-writer", title: "Short Script Writer", status: "success", durationMs: 1740, summary: "3 platform scripts." },
    { nodeId: "caption-writer", title: "Caption Writer", status: "success", durationMs: 1330, summary: "4 captions on-brand." },
    { nodeId: "posting-plan", title: "Posting Plan Generator", status: "success", durationMs: 1110, summary: "Scheduled 5 assets across the week." },
  ],
  tables: C_TABLES,
  finalOutput: {
    title: "Content Plan",
    summary: "One podcast clip became 5 hooks, 3 short scripts, 4 captions, and a 5-slot weekly calendar across 5 platforms.",
    highlights: [
      { label: "Hooks", value: "5", accent: "violet" },
      { label: "Scripts", value: "3", accent: "teal" },
      { label: "Captions", value: "4", accent: "green" },
      { label: "Scheduled", value: "5 posts", accent: "pink" },
    ],
  },
});

/* ────────────────────────────── Inbox Assistant ────────────────────────────── */

const I_TABLES: OutputTable[] = [
  {
    id: "classified_messages", name: "classified_messages", sourceNodeId: "intent-classifier",
    description: "Each message tagged by intent.",
    columns: [
      { key: "from", label: "From", type: "text" },
      { key: "subject", label: "Subject", type: "text" },
      { key: "intent", label: "Intent", type: "badge" },
    ],
    rows: [
      { from: "maria@acme.co", subject: "Renewal pricing?", intent: "Sales" },
      { from: "dev@vendor.io", subject: "API 500s since 9am", intent: "Support" },
      { from: "noreply@bank.com", subject: "Statement ready", intent: "FYI" },
      { from: "sam@partner.com", subject: "Intro to your CFO", intent: "Networking" },
      { from: "team@calendar.app", subject: "3 invites pending", intent: "Scheduling" },
    ],
  },
  {
    id: "priority_queue", name: "priority_queue", sourceNodeId: "priority-scorer",
    description: "Ranked by urgency + impact.",
    columns: [
      { key: "rank", label: "#", type: "number" },
      { key: "subject", label: "Subject", type: "text" },
      { key: "priority", label: "Priority", type: "badge" },
      { key: "sla", label: "SLA", type: "text" },
    ],
    rows: [
      { rank: 1, subject: "API 500s since 9am", priority: "Urgent", sla: "30 min" },
      { rank: 2, subject: "Renewal pricing?", priority: "High", sla: "2 hr" },
      { rank: 3, subject: "Intro to your CFO", priority: "Medium", sla: "Today" },
      { rank: 4, subject: "3 invites pending", priority: "Low", sla: "Today" },
    ],
  },
  {
    id: "draft_replies", name: "draft_replies", sourceNodeId: "draft-reply",
    description: "Ready-to-send drafts awaiting approval.",
    columns: [
      { key: "to", label: "To", type: "text" },
      { key: "draft", label: "Draft", type: "text" },
      { key: "status", label: "Status", type: "badge" },
    ],
    rows: [
      { to: "dev@vendor.io", draft: "We see the 500s and are rolling back the 9am deploy now — ETA 20 min. Status page updating.", status: "Needs approval" },
      { to: "maria@acme.co", draft: "Happy to share renewal options — sending a 2-tier quote today with the loyalty discount applied.", status: "Needs approval" },
      { to: "sam@partner.com", draft: "Glad to connect you — looping in our CFO and proposing Thursday.", status: "Draft" },
    ],
  },
  {
    id: "followups", name: "followups", sourceNodeId: "followup-scheduler",
    description: "Scheduled nudges.",
    columns: [
      { key: "subject", label: "Subject", type: "text" },
      { key: "when", label: "When", type: "text" },
      { key: "channel", label: "Channel", type: "badge" },
    ],
    rows: [
      { subject: "Renewal pricing?", when: "in 2 days", channel: "Email" },
      { subject: "Intro to your CFO", when: "Thu 9am", channel: "Calendar" },
      { subject: "3 invites pending", when: "EOD", channel: "Email" },
    ],
  },
];

export const inboxPipeline = P({
  id: "tpl-inbox",
  name: "Inbox Assistant",
  description: "Classifies inbox messages, prioritizes them, drafts replies, and schedules follow-ups behind a human approval gate.",
  nodes: [
    { id: "input", type: "input", title: "Input", subtitle: "Inbox Messages", description: "A batch of unread inbox messages.", color: "blue", outputs: ["messages"], position: { x: 40, y: 320 } },
    { id: "intent-classifier", type: "agent", title: "Intent Classifier", subtitle: "Tag intent", description: "Classify each message by intent.", role: "Triage classifier", prompt: "Classify each message by intent (Sales, Support, FYI, Networking, Scheduling, …). Return from, subject, intent.", color: "cyan", inputs: ["messages"], outputs: ["classified_messages"], position: { x: 330, y: 320 } },
    { id: "priority-scorer", type: "evaluator", title: "Priority Scorer", subtitle: "Rank urgency", description: "Score and rank messages by urgency and impact.", role: "Prioritization engine", prompt: "Rank the classified messages by urgency × impact. Return rank, subject, priority, and an SLA.", color: "gold", inputs: ["classified_messages"], outputs: ["priority_queue"], position: { x: 620, y: 300 } },
    { id: "draft-reply", type: "agent", title: "Draft Reply Agent", subtitle: "Write replies", description: "Draft a reply for the top messages.", role: "Reply writer", prompt: "Draft concise, on-tone replies for the highest-priority messages. Return to, draft, status.", color: "violet", inputs: ["priority_queue"], outputs: ["draft_replies"], position: { x: 910, y: 300 } },
    { id: "followup-scheduler", type: "agent", title: "Follow-Up Scheduler", subtitle: "Schedule nudges", description: "Schedule follow-ups for unresolved threads.", role: "Scheduler", prompt: "For threads needing a nudge, schedule a follow-up. Return subject, when, channel.", color: "teal", inputs: ["priority_queue"], outputs: ["followups"], position: { x: 910, y: 520 } },
    { id: "approval-gate", type: "output", title: "Human Approval Gate", subtitle: "Approve & send", description: "Holds drafts for human approval before sending.", role: "Approval gate", prompt: "Summarize what is queued and what needs human approval before sending.", color: "pink", inputs: ["draft_replies", "followups"], outputs: ["approved"], position: { x: 1200, y: 410 } },
  ],
  edges: [
    { id: "e1", source: "input", target: "intent-classifier", dataKey: "messages" },
    { id: "e2", source: "intent-classifier", target: "priority-scorer", dataKey: "classified_messages" },
    { id: "e3", source: "priority-scorer", target: "draft-reply", dataKey: "priority_queue" },
    { id: "e4", source: "priority-scorer", target: "followup-scheduler", dataKey: "priority_queue" },
    { id: "e5", source: "draft-reply", target: "approval-gate", dataKey: "draft_replies" },
    { id: "e6", source: "followup-scheduler", target: "approval-gate", dataKey: "followups" },
  ],
  mockInputs: [
    { key: "messages", label: "Messages", value: "5 unread: renewal question, API outage, bank FYI, partner intro, calendar invites." },
  ],
  outputTables: I_TABLES,
  uiBindings: [
    { id: "b-queue", tableId: "priority_queue", componentType: "recordList", title: "Priority Inbox", position: 0, fields: ["rank", "subject", "priority", "sla"] },
    { id: "b-draft", tableId: "draft_replies", componentType: "summaryCard", title: "Reply Draft", position: 1, fields: ["to", "draft", "status"] },
  ],
});

const inboxRun = R({
  id: "run-inbox-example",
  pipelineId: "tpl-inbox",
  status: "success",
  startedAt: ISO(7),
  finishedAt: ISO(6),
  steps: [
    { nodeId: "input", title: "Input", status: "success", durationMs: 80, summary: "Loaded 5 messages." },
    { nodeId: "intent-classifier", title: "Intent Classifier", status: "success", durationMs: 1240, summary: "Tagged 5 intents." },
    { nodeId: "priority-scorer", title: "Priority Scorer", status: "success", durationMs: 900, summary: "1 urgent, 1 high." },
    { nodeId: "draft-reply", title: "Draft Reply Agent", status: "success", durationMs: 1600, summary: "Drafted 3 replies." },
    { nodeId: "followup-scheduler", title: "Follow-Up Scheduler", status: "success", durationMs: 760, summary: "Scheduled 3 nudges." },
    { nodeId: "approval-gate", title: "Human Approval Gate", status: "success", durationMs: 220, summary: "2 drafts await approval." },
  ],
  tables: I_TABLES,
  finalOutput: {
    title: "Inbox Triage",
    summary: "5 messages triaged: 1 urgent outage escalated, 3 replies drafted, and 3 follow-ups scheduled. 2 drafts are waiting on your approval.",
    highlights: [
      { label: "Messages", value: "5", accent: "blue" },
      { label: "Urgent", value: "1", accent: "red" },
      { label: "Drafts", value: "3", accent: "violet" },
      { label: "Follow-ups", value: "3", accent: "teal" },
    ],
  },
});

/* ──────────────────────────── Research (fallback) ──────────────────────────── */

const RS_TABLES: OutputTable[] = [
  {
    id: "sources", name: "sources", sourceNodeId: "source-collector",
    description: "Collected sources with credibility.",
    columns: [
      { key: "title", label: "Source", type: "text" },
      { key: "type", label: "Type", type: "badge" },
      { key: "credibility", label: "Credibility", type: "text" },
    ],
    rows: [
      { title: "Industry market report 2026", type: "Report", credibility: "High" },
      { title: "Vendor pricing pages (n=6)", type: "Primary", credibility: "Medium" },
      { title: "Analyst commentary", type: "Opinion", credibility: "Medium" },
      { title: "Community forum threads", type: "Anecdote", credibility: "Low" },
    ],
  },
  {
    id: "key_findings", name: "key_findings", sourceNodeId: "summarizer",
    description: "Distilled findings.",
    columns: [
      { key: "finding", label: "Finding", type: "text" },
      { key: "confidence", label: "Confidence", type: "badge" },
    ],
    rows: [
      { finding: "Market is consolidating around 3 incumbents.", confidence: "High" },
      { finding: "Mid-market pricing has compressed ~12% YoY.", confidence: "Medium" },
      { finding: "Switching costs are the primary moat.", confidence: "Medium" },
    ],
  },
  {
    id: "report", name: "report", sourceNodeId: "report-generator",
    description: "Executive thesis.",
    columns: [
      { key: "section", label: "Section", type: "text" },
      { key: "content", label: "Content", type: "text" },
    ],
    rows: [
      { section: "Thesis", content: "Differentiate on integration depth, not price — the mid-market is fatigued by switching costs." },
      { section: "Risk", content: "Incumbent bundling could erode the wedge within 4 quarters." },
    ],
  },
];

export const researchPipeline = P({
  id: "tpl-research",
  name: "Market Research Engine",
  description: "Turns a question into sourced findings, contradiction checks, and an executive thesis report.",
  nodes: [
    { id: "input", type: "input", title: "Input", subtitle: "Research Query", description: "The question to investigate.", color: "blue", outputs: ["query"], position: { x: 40, y: 320 } },
    { id: "source-collector", type: "tool", title: "Source Collector", subtitle: "Gather sources", description: "Collect candidate sources for the query.", role: "Research collector", prompt: "Collect 4–8 candidate sources for the query. Return title, type, and a credibility read.", color: "cyan", inputs: ["query"], outputs: ["sources"], position: { x: 330, y: 320 } },
    { id: "credibility-ranker", type: "evaluator", title: "Credibility Ranker", subtitle: "Rank trust", description: "Rank sources by credibility.", role: "Credibility analyst", prompt: "Rank the sources by credibility and flag weak ones.", color: "gold", inputs: ["sources"], outputs: ["ranked_sources"], position: { x: 620, y: 320 } },
    { id: "summarizer", type: "agent", title: "Summarizer", subtitle: "Distill findings", description: "Summarize the credible sources into findings.", role: "Synthesis analyst", prompt: "Distill the credible sources into 3–5 key findings with confidence levels.", color: "violet", inputs: ["ranked_sources"], outputs: ["key_findings"], position: { x: 910, y: 300 } },
    { id: "contradiction-checker", type: "evaluator", title: "Contradiction Checker", subtitle: "Find conflicts", description: "Check findings for contradictions.", role: "Red-team checker", prompt: "Check the findings for contradictions or weak support; note any conflicts.", color: "orange", inputs: ["key_findings"], outputs: ["checked_findings"], position: { x: 910, y: 520 } },
    { id: "report-generator", type: "output", title: "Report Generator", subtitle: "Build the thesis", description: "Assemble an executive thesis report.", role: "Report writer", prompt: "Write an executive thesis report (sections: Thesis, Evidence, Risk) from the checked findings.", color: "pink", inputs: ["checked_findings"], outputs: ["report"], position: { x: 1200, y: 410 } },
  ],
  edges: [
    { id: "e1", source: "input", target: "source-collector", dataKey: "query" },
    { id: "e2", source: "source-collector", target: "credibility-ranker", dataKey: "sources" },
    { id: "e3", source: "credibility-ranker", target: "summarizer", dataKey: "ranked_sources" },
    { id: "e4", source: "summarizer", target: "contradiction-checker", dataKey: "key_findings" },
    { id: "e5", source: "contradiction-checker", target: "report-generator", dataKey: "checked_findings" },
  ],
  mockInputs: [
    { key: "query", label: "Research Query", value: "How should a mid-market SaaS position against consolidating incumbents in 2026?" },
  ],
  outputTables: RS_TABLES,
  uiBindings: [
    { id: "b-find", tableId: "key_findings", componentType: "recordList", title: "Key Findings", position: 0, fields: ["finding", "confidence"] },
    { id: "b-report", tableId: "report", componentType: "summaryCard", title: "Executive Thesis", position: 1, fields: ["section", "content"] },
  ],
});

const researchRun = R({
  id: "run-research-example",
  pipelineId: "tpl-research",
  status: "success",
  startedAt: ISO(9),
  finishedAt: ISO(8),
  steps: [
    { nodeId: "input", title: "Input", status: "success", durationMs: 80, summary: "Loaded research query." },
    { nodeId: "source-collector", title: "Source Collector", status: "success", durationMs: 1900, summary: "Collected 4 sources." },
    { nodeId: "credibility-ranker", title: "Credibility Ranker", status: "success", durationMs: 700, summary: "1 low-credibility source flagged." },
    { nodeId: "summarizer", title: "Summarizer", status: "success", durationMs: 1500, summary: "3 findings distilled." },
    { nodeId: "contradiction-checker", title: "Contradiction Checker", status: "success", durationMs: 820, summary: "No hard contradictions." },
    { nodeId: "report-generator", title: "Report Generator", status: "success", durationMs: 1400, summary: "Thesis report assembled." },
  ],
  tables: RS_TABLES,
  finalOutput: {
    title: "Research Report",
    summary: "From 4 sources: the market is consolidating around 3 incumbents with ~12% price compression. Recommended thesis — differentiate on integration depth, not price.",
    highlights: [
      { label: "Sources", value: "4", accent: "cyan" },
      { label: "Findings", value: "3", accent: "violet" },
      { label: "Confidence", value: "Medium-High", accent: "gold" },
    ],
  },
});

/* ──────────────────────────────── registry ─────────────────────────────────── */

export type Template = {
  id: string;
  label: string;
  blurb: string;
  keywords: string[];
  pipeline: Pipeline;
  exampleRun: RunTrace;
  takes?: Take[];
};

export const TEMPLATES: Template[] = [
  {
    id: "tpl-real-estate",
    label: "Real Estate Deal Analyzer",
    blurb: "Address → comps → ARV → repairs → score → buyer pitch.",
    keywords: ["real estate", "property", "arv", "deal", "comps", "wholesale", "rehab", "house", "flip", "rent"],
    pipeline: realEstatePipeline,
    exampleRun: realEstateRun,
  },
  {
    id: "tpl-content",
    label: "Content Repurposer",
    blurb: "One idea → hooks, scripts, captions, posting plan.",
    keywords: ["content", "social", "video", "caption", "post", "tiktok", "instagram", "reels", "newsletter", "brand"],
    pipeline: contentPipeline,
    exampleRun: contentRun,
  },
  {
    id: "tpl-inbox",
    label: "Inbox Assistant",
    blurb: "Messages → classify, prioritize, draft, schedule.",
    keywords: ["inbox", "email", "message", "reply", "support", "triage", "ticket"],
    pipeline: inboxPipeline,
    exampleRun: inboxRun,
  },
  {
    id: "tpl-research",
    label: "Market Research Engine",
    blurb: "Query → sources → findings → thesis report.",
    keywords: ["research", "market", "competitor", "intelligence", "analysis", "report", "thesis"],
    pipeline: researchPipeline,
    exampleRun: researchRun,
  },
  ...TEAM_TEMPLATES,
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Deterministic keyword routing used as the offline / fallback generator. */
export function matchTemplate(description: string): Template {
  const d = description.toLowerCase();
  let best: Template = TEMPLATES[3]; // research = generic default
  let bestScore = 0;
  for (const t of TEMPLATES) {
    const score = t.keywords.reduce((s, k) => (d.includes(k) ? s + 1 : s), 0);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Instantiate a template (or any pipeline) as a fresh, editable working copy. */
export function instantiatePipeline(source: Pipeline, name?: string): Pipeline {
  return pipelineSchema.parse({
    ...source,
    id: newId(),
    name: name ?? source.name,
    nodes: source.nodes.map((n) => ({ ...n, status: "idle" })),
    runHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
