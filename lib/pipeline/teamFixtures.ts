import {
  pipelineSchema,
  runTraceSchema,
  type HandoffPacket,
  type OutputTable,
  type Pipeline,
  type RunTrace,
} from "./schema";
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
};

/* ════════════════════ Jarvis Places Radar (teams + packets) ════════════════════ */

/** Reusable Input Studio dataset for the Source Team. */
export const JARVIS_PLACES_DATASET: Dataset = datasetSchema.parse({
  id: "ds-places-seed",
  name: "Upscale Chicago Dinner Candidates",
  description: "30 realistic upscale Chicago dinner candidates with Google-Places-like fields.",
  mode: "input_studio",
  sourcePrompt:
    "Generate 30 realistic upscale Chicago dinner candidates with fields similar to Google Places results.",
  qualityScore: 92,
  schema: [
    { key: "name", label: "Place", type: "text" },
    { key: "neighborhood", label: "Area", type: "text" },
    { key: "cuisine", label: "Cuisine", type: "text" },
    { key: "price", label: "Price", type: "badge" },
    { key: "rating", label: "Rating", type: "number" },
    { key: "vibe", label: "Vibe", type: "badge" },
    { key: "parking", label: "Parking", type: "badge" },
  ],
  rows: [
    { name: "Ember & Oak", neighborhood: "West Loop", cuisine: "New American", price: "$$$", rating: 4.7, vibe: "elevated", parking: "valet" },
    { name: "Lune", neighborhood: "River North", cuisine: "French", price: "$$$$", rating: 4.6, vibe: "intimate", parking: "street" },
    { name: "Saffron Hall", neighborhood: "Fulton Market", cuisine: "Modern Indian", price: "$$$", rating: 4.8, vibe: "buzzy", parking: "lot" },
    { name: "The Lakehouse", neighborhood: "Streeterville", cuisine: "Seafood", price: "$$$$", rating: 4.5, vibe: "scenic", parking: "valet" },
    { name: "Cinta", neighborhood: "Logan Square", cuisine: "Spanish", price: "$$", rating: 4.6, vibe: "lively", parking: "street" },
    { name: "Maison Verre", neighborhood: "Gold Coast", cuisine: "French", price: "$$$$", rating: 4.7, vibe: "refined", parking: "valet" },
    { name: "Toro & Vine", neighborhood: "West Loop", cuisine: "Steak", price: "$$$", rating: 4.5, vibe: "elevated", parking: "lot" },
    { name: "Koi Garden", neighborhood: "River North", cuisine: "Japanese", price: "$$$", rating: 4.7, vibe: "sleek", parking: "valet" },
  ],
});

const JARVIS_TABLES: OutputTable[] = [
  {
    id: "places",
    name: "places",
    sourceNodeId: "source-team",
    description: "Candidate places from the Source Team.",
    columns: JARVIS_PLACES_DATASET.schema,
    rows: JARVIS_PLACES_DATASET.rows,
  },
  {
    id: "taste_profile",
    name: "taste_profile",
    sourceNodeId: "taste-team",
    description: "Compressed taste direction from the Taste Team council.",
    columns: [
      { key: "direction", label: "Direction", type: "text" },
      { key: "avoid", label: "Avoid", type: "text" },
      { key: "prioritize", label: "Prioritize", type: "text" },
      { key: "confidence", label: "Confidence", type: "percent" },
    ],
    rows: [
      {
        direction: "upscale but not flashy",
        avoid: "tourist traps, corny luxury, generic chains",
        prioritize: "atmosphere, food quality, parking, subtly photo-worthy",
        confidence: 86,
      },
    ],
  },
  {
    id: "ranked_places",
    name: "ranked_places",
    sourceNodeId: "ranking-team",
    description: "Top picks ranked by the Ranking Team vote.",
    columns: [
      { key: "rank", label: "#", type: "number" },
      { key: "name", label: "Place", type: "text" },
      { key: "score", label: "Score", type: "number" },
      { key: "taste_match", label: "Taste", type: "percent" },
      { key: "vibe_match", label: "Vibe", type: "percent" },
      { key: "corny_risk", label: "Corny", type: "badge" },
      { key: "why", label: "Why", type: "text" },
    ],
    rows: [
      { rank: 1, name: "Ember & Oak", score: 91, taste_match: 93, vibe_match: 90, corny_risk: "low", why: "Elevated, great atmosphere, valet — fits the brief cleanly." },
      { rank: 2, name: "Saffron Hall", score: 88, taste_match: 90, vibe_match: 88, corny_risk: "low", why: "Buzzy and excellent food; lot parking nearby." },
      { rank: 3, name: "Koi Garden", score: 86, taste_match: 87, vibe_match: 89, corny_risk: "low", why: "Sleek, photo-worthy without being flashy." },
      { rank: 4, name: "Maison Verre", score: 84, taste_match: 88, vibe_match: 82, corny_risk: "medium", why: "Refined French; slightly formal for a weekday." },
      { rank: 5, name: "Toro & Vine", score: 82, taste_match: 83, vibe_match: 81, corny_risk: "low", why: "Solid steak, easy logistics." },
      { rank: 6, name: "Cinta", score: 80, taste_match: 84, vibe_match: 85, corny_risk: "low", why: "Lively and affordable; street parking only." },
    ],
  },
  {
    id: "plan",
    name: "plan",
    sourceNodeId: "planning-team",
    description: "Logistics from the Planning Team.",
    columns: [
      { key: "step", label: "Step", type: "text" },
      { key: "detail", label: "Detail", type: "text" },
      { key: "time", label: "Time", type: "text" },
    ],
    rows: [
      { step: "Leave", detail: "~18 min drive to West Loop", time: "6:40p" },
      { step: "Reservation", detail: "Ember & Oak, table for 2", time: "7:00p" },
      { step: "Backup", detail: "Saffron Hall held until 7:10p", time: "—" },
    ],
  },
  {
    id: "itinerary",
    name: "itinerary",
    sourceNodeId: "final-composer",
    description: "Final composed itinerary surface.",
    columns: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "summary", label: "Summary", type: "text" },
      { key: "pick", label: "Pick", type: "text" },
      { key: "time", label: "Time", type: "text" },
    ],
    rows: [
      {
        headline: "Ember & Oak — elevated, easy, photo-worthy",
        summary:
          "A West Loop New American spot that nails 'upscale but not flashy' with valet parking and a strong atmosphere. Leave by 6:40 for a 7:00 reservation; Saffron Hall is held as backup.",
        pick: "Ember & Oak",
        time: "7:00p",
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

export const jarvisPipeline = P({
  id: "tpl-jarvis",
  name: "Jarvis Places Radar",
  description:
    "A multi-team night-out system: Source → Taste → Ranking → Planning → Composer. The canvas shows departments; each Team Node opens a Crew Room and hands off a slim packet.",
  datasetIds: ["ds-places-seed"],
  blueprint: {
    name: "Jarvis Places Radar",
    pitch: "Tell it your vibe; it scouts, judges, plans, and composes a night out.",
    targetUser: "People who want a great night out without the research grind.",
    vibeTags: ["personal", "taste-aware", "effortless"],
    coreValue: "Turns a vague vibe into a booked, logistics-checked plan.",
    workflowSummary: "Source places → profile taste → rank by fit → plan logistics → compose itinerary.",
    keyDataObjects: ["places", "taste_profile", "ranked_places", "plan", "itinerary"],
    uiSurfaces: ["Top Picks grid", "Tonight's Plan card", "Logistics list"],
    missingApis: ["Google Places (live)", "Maps drive-time", "Reservation API"],
    fastestMvpPath: "Use Input Studio places + manual reservation; wire Places + Maps later.",
    monetization: "Subscription for power users; affiliate on reservations.",
  },
  realityMeter: {
    buildability: 72,
    missing: ["Live Places API", "Drive-time API", "Reservation booking"],
    hardestPart: "Reliable real-time place data + reservation availability.",
    fastestMvpPath: "Input Studio seed data → live Places API for one city.",
    costRisk: "medium",
    complexityRisk: "high",
    dataQualityRisk: "medium",
    recommendedNext: "Wire Google Places for the Source Team, keep the rest mocked.",
    fakeFirst: ["place data", "drive times"],
    automateLater: ["reservations", "calendar holds"],
  },
  nodes: [
    {
      id: "input",
      type: "input",
      layer: "source",
      title: "Brief",
      subtitle: "Vibe + constraints",
      description: "The user's vibe, budget, and constraints for tonight.",
      color: "cyan",
      outputs: ["brief"],
      position: { x: 40, y: 180 },
    },
    {
      id: "source-team",
      type: "tool",
      layer: "source",
      title: "Source Team",
      subtitle: "Scout candidates",
      description: "Collects + enriches candidate places (Input Studio or live Places API).",
      color: "blue",
      outputs: ["places"],
      position: { x: 40, y: 460 },
      source: {
        mode: "input_studio",
        datasetId: "ds-places-seed",
        prompt: "30 realistic upscale Chicago dinner candidates",
        rowCount: 30,
      },
      team: team(
        "parallel",
        [
          { id: "collector", name: "Collector", role: "Places collector", prompt: "Pull candidate places with name, area, cuisine, price, rating, vibe, parking.", isLead: true },
          { id: "enricher", name: "Enricher", role: "Detail enricher", prompt: "Add ratings, vibe tags, and parking notes to each candidate." },
        ],
        "collector",
      ),
    },
    {
      id: "taste-team",
      type: "agent",
      layer: "brain",
      title: "Taste Team",
      subtitle: "Profile the vibe",
      description: "A council that compresses the user's taste into a slim profile.",
      color: "violet",
      inputs: ["brief", "places"],
      outputs: ["taste_profile"],
      position: { x: 380, y: 300 },
      team: team(
        "council",
        [
          { id: "chair", name: "Chair", role: "Synthesizer", prompt: "Compress the council's views into one taste direction.", isLead: true },
          { id: "taste-profiler", name: "Taste Profiler", role: "Preference analyst", prompt: "Infer what the user actually wants from the brief." },
          { id: "vibe-analyst", name: "Vibe Analyst", role: "Atmosphere reader", prompt: "Judge atmosphere and photo-worthiness without flashiness." },
          { id: "corny-detector", name: "Corny Detector", role: "Taste guardrail", prompt: "Flag tourist-trap / corny-luxury risk." },
        ],
        "chair",
      ),
    },
    {
      id: "ranking-team",
      type: "evaluator",
      layer: "brain",
      title: "Ranking Team",
      subtitle: "Score + vote",
      description: "Independent scorers vote; an aggregator merges into a ranking.",
      color: "gold",
      inputs: ["places", "taste_profile"],
      outputs: ["ranked_places"],
      position: { x: 700, y: 300 },
      evalDimensions: ["taste_match", "vibe_match", "corny_risk", "location_fit", "budget_fit"],
      team: team(
        "vote",
        [
          { id: "aggregator", name: "Aggregator", role: "Vote aggregator", prompt: "Merge scorer votes into a ranked list with reasons.", isLead: true },
          { id: "scorer-food", name: "Food Scorer", role: "Food quality", prompt: "Score food quality and fit." },
          { id: "scorer-vibe", name: "Vibe Scorer", role: "Atmosphere", prompt: "Score vibe/atmosphere match." },
          { id: "scorer-logistics", name: "Logistics Scorer", role: "Logistics", prompt: "Score parking, distance, and ease." },
        ],
        "aggregator",
      ),
    },
    {
      id: "planning-team",
      type: "agent",
      layer: "brain",
      title: "Planning Team",
      subtitle: "Lock logistics",
      description: "Plans drive time, reservation timing, and a backup.",
      color: "teal",
      inputs: ["ranked_places"],
      outputs: ["plan"],
      position: { x: 1020, y: 180 },
      team: team(
        "sequential",
        [
          { id: "logistics", name: "Logistics", role: "Logistics planner", prompt: "Compute drive time and constraints." },
          { id: "scheduler", name: "Scheduler", role: "Scheduler", prompt: "Pick reservation timing + a backup hold.", isLead: true },
        ],
        "scheduler",
      ),
    },
    {
      id: "final-composer",
      type: "output",
      layer: "surface",
      title: "Final Composer",
      subtitle: "Compose the night",
      description: "Composes the itinerary surface + UI cards.",
      color: "pink",
      inputs: ["ranked_places", "plan", "taste_profile"],
      outputs: ["itinerary"],
      position: { x: 1020, y: 460 },
      team: team("single", [
        { id: "composer", name: "Composer", role: "Itinerary writer", prompt: "Write a confident, warm itinerary using the top pick + plan.", isLead: true },
      ]),
    },
  ],
  edges: [
    { id: "je1", source: "input", target: "taste-team", dataKey: "brief" },
    { id: "je2", source: "source-team", target: "taste-team", dataKey: "places", label: "places", packetId: "pkt_source", contract: { provides: [{ key: "places", type: "array", required: true }], expects: [{ key: "places", type: "array", required: true }], status: "ok" } },
    { id: "je3", source: "source-team", target: "ranking-team", dataKey: "places" },
    { id: "je4", source: "taste-team", target: "ranking-team", dataKey: "taste_profile", label: "taste_profile", packetId: "pkt_taste" },
    { id: "je5", source: "ranking-team", target: "planning-team", dataKey: "ranked_places", label: "ranked_places", packetId: "pkt_ranking" },
    { id: "je6", source: "ranking-team", target: "final-composer", dataKey: "ranked_places" },
    { id: "je7", source: "planning-team", target: "final-composer", dataKey: "plan", label: "plan", packetId: "pkt_planning" },
    { id: "je8", source: "taste-team", target: "final-composer", dataKey: "taste_profile" },
  ],
  mockInputs: [
    { key: "vibe", label: "Vibe", value: "upscale but not flashy, great atmosphere, easy parking" },
    { key: "city", label: "City", value: "Chicago" },
    { key: "budget", label: "Budget", value: "$$$" },
    { key: "max_drive", label: "Max drive", value: "35 min" },
  ],
  outputTables: JARVIS_TABLES,
  uiBindings: [
    { id: "jb-picks", tableId: "ranked_places", componentType: "cardGrid", title: "Top Picks", position: 0, fields: ["name", "score", "why"] },
    { id: "jb-plan", tableId: "itinerary", componentType: "summaryCard", title: "Tonight's Plan", position: 1, fields: ["headline", "summary"] },
    { id: "jb-logistics", tableId: "plan", componentType: "timeline", title: "Logistics", position: 2, fields: ["step", "detail", "time"] },
    { id: "jb-taste", tableId: "taste_profile", componentType: "summaryCard", title: "Your Taste", position: 3, fields: ["direction", "prioritize"] },
  ],
});

const JARVIS_PACKETS: HandoffPacket[] = [
  {
    packetId: "pkt_source",
    fromNodeId: "source-team",
    toNodeId: "taste-team",
    summary: "30 upscale Chicago candidates collected and enriched with ratings, vibe, and parking.",
    keyFields: { count: 30, neighborhoods: ["West Loop", "River North", "Fulton Market"], price_range: "$$–$$$$", parking_available: true },
    confidence: 0.9,
    assumptions: ["Dinner, party of 2."],
    missingData: ["Live availability."],
    warnings: [],
    sourceReferences: ["ds-places-seed"],
    fieldChanges: { added: ["vibe", "parking", "rating"], compressed: ["raw_place_notes"], dropped: [] },
    nextAction: "Profile the user's taste against these candidates.",
  },
  {
    packetId: "pkt_taste",
    fromNodeId: "taste-team",
    toNodeId: "ranking-team",
    summary: "User prefers elevated, low-corny dinner options with strong atmosphere and manageable logistics.",
    keyFields: { taste_direction: "upscale but not flashy", avoid: ["tourist traps", "corny luxury", "generic chains"], prioritize: ["atmosphere", "food quality", "parking", "photo-worthy but subtle"] },
    confidence: 0.86,
    assumptions: ["User is willing to drive up to 35 minutes."],
    missingData: ["Exact budget comfort tonight."],
    warnings: ["Some options may be too far for a weekday."],
    sourceReferences: ["brief", "places"],
    fieldChanges: { added: ["taste_direction", "avoid"], compressed: ["raw_place_notes"], dropped: [] },
    nextAction: "Score + rank candidates against this taste profile.",
  },
  {
    packetId: "pkt_ranking",
    fromNodeId: "ranking-team",
    toNodeId: "planning-team",
    summary: "Top 6 ranked by taste + vibe; Ember & Oak leads. (Note: parking_available not carried forward.)",
    keyFields: { top_pick: "Ember & Oak", avg_score: 85, count: 6 },
    confidence: 0.82,
    assumptions: [],
    missingData: [],
    warnings: ["Two options are 30+ minutes away on a weekday."],
    sourceReferences: ["places", "taste_profile"],
    fieldChanges: { added: ["score", "taste_match", "vibe_match"], compressed: ["per_scorer_votes"], dropped: [] },
    nextAction: "Plan logistics for the top pick + a backup.",
  },
  {
    packetId: "pkt_planning",
    fromNodeId: "planning-team",
    toNodeId: "final-composer",
    summary: "Leave 6:40, reservation 7:00 at Ember & Oak, Saffron Hall held as backup.",
    keyFields: { drive_min: 18, reservation: "7:00p", backup: "Saffron Hall" },
    confidence: 0.88,
    assumptions: ["Reservation available at 7:00."],
    missingData: [],
    warnings: [],
    sourceReferences: ["ranked_places"],
    fieldChanges: { added: ["drive_min", "reservation"], compressed: [], dropped: [] },
    nextAction: "Compose the final itinerary surface.",
  },
];

const jarvisRun = R({
  id: "run-jarvis-example",
  pipelineId: "tpl-jarvis",
  status: "success",
  startedAt: ISO(6),
  finishedAt: ISO(4),
  costUsd: 0.071,
  latencyMs: 12800,
  steps: [
    { nodeId: "input", title: "Brief", status: "success", kind: "node", durationMs: 90, summary: "Loaded vibe + constraints." },
    { nodeId: "source-team", title: "Source Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 2600, confidence: 0.9, summary: "30 candidates collected + enriched." },
    { nodeId: "taste-team", title: "Taste Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 3100, confidence: 0.86, summary: "Council compressed taste → packet." },
    { nodeId: "ranking-team", title: "Ranking Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 2900, confidence: 0.82, summary: "Voted, ranked top 6." },
    { nodeId: "planning-team", title: "Planning Team", status: "success", kind: "team", model: "claude-sonnet-4-6", durationMs: 1700, confidence: 0.88, summary: "Locked reservation + backup." },
    { nodeId: "final-composer", title: "Final Composer", status: "success", kind: "team", model: "claude-opus-4-8", durationMs: 1400, summary: "Composed itinerary surface." },
  ],
  tables: JARVIS_TABLES,
  packets: JARVIS_PACKETS,
  finalOutput: {
    title: "Tonight's Plan",
    summary:
      "Ember & Oak in West Loop nails 'upscale but not flashy' — strong atmosphere, valet parking, low corny risk. Leave by 6:40 for a 7:00 reservation; Saffron Hall held as backup.",
    highlights: [
      { label: "Top Pick", value: "Ember & Oak", accent: "violet" },
      { label: "Score", value: "91 / 100", accent: "gold" },
      { label: "Drive", value: "18 min", accent: "teal" },
      { label: "Corny Risk", value: "Low", accent: "green" },
      { label: "Reservation", value: "7:00p", accent: "pink" },
    ],
  },
});

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
    id: "tpl-jarvis",
    label: "Jarvis Places Radar",
    blurb: "Teams of agents → handoff packets → a planned night out.",
    keywords: ["jarvis", "places", "radar", "team", "crew", "night out", "dinner", "restaurant", "agents", "council"],
    pipeline: jarvisPipeline,
    exampleRun: jarvisRun,
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
