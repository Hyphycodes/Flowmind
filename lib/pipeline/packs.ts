import type { Accent } from "@/lib/ui/colors";
import { TEMPLATES, type Template } from "./fixtures";

/** Template packs — preset families of Flowmind systems, not boring examples. */
export type TemplatePack = {
  id: string;
  label: string;
  purpose: string;
  accent: Accent;
  templateIds: string[];
};

export const PACKS: TemplatePack[] = [
  {
    id: "pack-jarvis",
    label: "Jarvis Pack",
    purpose: "Personal operating assistants — taste, planning, and recommendations.",
    accent: "violet",
    templateIds: ["tpl-jarvis", "tpl-meal"],
  },
  {
    id: "pack-real-estate",
    label: "Real Estate Pack",
    purpose: "Investor, wholesaling, and deal-analysis systems.",
    accent: "gold",
    templateIds: ["tpl-real-estate"],
  },
  {
    id: "pack-content",
    label: "Content Studio Pack",
    purpose: "Creators, agencies, and marketers.",
    accent: "pink",
    templateIds: ["tpl-content"],
  },
  {
    id: "pack-inbox",
    label: "Inbox Operator Pack",
    purpose: "Email, admin, and support workflows.",
    accent: "cyan",
    templateIds: ["tpl-inbox"],
  },
  {
    id: "pack-research",
    label: "Research Analyst Pack",
    purpose: "Market, investment, and competitive intelligence.",
    accent: "teal",
    templateIds: ["tpl-research"],
  },
  {
    id: "pack-sales",
    label: "Sales Agent Pack",
    purpose: "Lead qualification, enrichment, and outbound.",
    accent: "blue",
    templateIds: ["tpl-sales"],
  },
  {
    id: "pack-stylist",
    label: "AI Stylist Pack",
    purpose: "Visual, taste, and lifestyle recommendations.",
    accent: "orange",
    templateIds: ["tpl-outfit"],
  },
];

export type PackWithTemplates = TemplatePack & { templates: Template[] };

/** Packs with their resolved templates (skips any unknown ids). */
export function packsWithTemplates(): PackWithTemplates[] {
  return PACKS.map((pack) => ({
    ...pack,
    templates: pack.templateIds.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean) as Template[],
  })).filter((p) => p.templates.length > 0);
}

/** The pack a template belongs to (for badges). */
export function packForTemplate(templateId: string): TemplatePack | undefined {
  return PACKS.find((p) => p.templateIds.includes(templateId));
}
