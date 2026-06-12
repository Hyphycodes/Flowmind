import type { ScenarioSet } from "@/lib/pipeline/schema";

/** Built-in Scenario Sets for the Input Studio. A scenario tags a dataset so a
 *  Source node can switch which Generated Dataset it tests against. */
export const SCENARIO_PRESETS: ScenarioSet[] = [
  { id: "sc-date-night", name: "Date night in Chicago", tag: "date_night", description: "Romantic, upscale, photo-worthy but not flashy.", prompt: "upscale Chicago dinner spots for a date night — atmospheric, not corny", datasetIds: [] },
  { id: "sc-rainy-sunday", name: "Rainy Sunday", tag: "rainy_sunday", description: "Cozy indoor spots, low effort, comfort-forward.", prompt: "cozy rainy-Sunday spots — warm, comforting, easy", datasetIds: [] },
  { id: "sc-family", name: "Family-friendly afternoon", tag: "family", description: "Kid-friendly, casual, accommodating.", prompt: "family-friendly afternoon spots — casual, roomy, kid-ok", datasetIds: [] },
  { id: "sc-luxury-solo", name: "Luxury solo dinner", tag: "luxury_solo", description: "Refined solo bar seating, tasting menus.", prompt: "luxury solo dinner — counter seats, tasting menus, refined", datasetIds: [] },
  { id: "sc-cheap-cool", name: "Cheap but cool night", tag: "cheap_cool", description: "Budget-friendly but stylish and lively.", prompt: "cheap but cool night out — lively, stylish, affordable", datasetIds: [] },
  { id: "sc-tourist", name: "Tourist visiting", tag: "tourist", description: "Iconic, walkable, must-see energy.", prompt: "tourist-friendly iconic spots — walkable, classic, scenic", datasetIds: [] },
  { id: "sc-low-energy", name: "Low-energy weekday", tag: "low_energy_weekday", description: "Quiet, quick, close, minimal logistics.", prompt: "low-energy weekday dinner — quiet, quick, nearby", datasetIds: [] },
  { id: "sc-high-energy", name: "High-energy weekend", tag: "high_energy_weekend", description: "Buzzy, social, going-out energy.", prompt: "high-energy weekend spots — buzzy, social, vibrant", datasetIds: [] },
];

export function scenarioByTag(tag?: string): ScenarioSet | undefined {
  if (!tag) return undefined;
  return SCENARIO_PRESETS.find((s) => s.tag === tag);
}
