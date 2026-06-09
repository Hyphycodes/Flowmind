import {
  Anchor,
  BadgeCheck,
  Bot,
  CalendarDays,
  Captions,
  Clapperboard,
  Clock,
  Compass,
  FileText,
  Filter,
  Gauge,
  GitCompare,
  Globe,
  ListOrdered,
  MessageSquareText,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  Target,
  Telescope,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Most-specific first. */
const KEYWORDS: [RegExp, LucideIcon][] = [
  [/repair|rehab|renov/, Wrench],
  [/comp|comparable|search|lookup/, Search],
  [/arv|valuation|apprais|value|estimat|price/, TrendingUp],
  [/score|grade|underwrit|deal scor/, Star],
  [/pitch|buyer|dispo|copywrit|sales letter/, MessageSquareText],
  [/angle|theme|strateg/, Compass],
  [/hook/, Anchor],
  [/script|video|short/, Clapperboard],
  [/caption|copy/, Captions],
  [/post|calendar|schedul|plan/, CalendarDays],
  [/classif|intent|tag|label/, Tags],
  [/priorit|rank|queue|triage/, ListOrdered],
  [/reply|draft|compose|write/, PenLine],
  [/follow|nudge|remind/, Clock],
  [/approv|gate|human|review/, ShieldCheck],
  [/source|collect|gather|crawl/, Globe],
  [/credib|trust|verif/, BadgeCheck],
  [/summ|distil|synth/, FileText],
  [/contradict|conflict|check/, GitCompare],
  [/research|market|intel|scout/, Telescope],
];

const TYPE_ICON: Record<string, LucideIcon> = {
  input: Target,
  agent: Sparkles,
  tool: Wrench,
  transformer: Filter,
  evaluator: Gauge,
  output: MessageSquareText,
};

export function iconForNode(node: { title?: string; role?: string; type: string }): LucideIcon {
  if (node.type === "input") return Target;
  const hay = `${node.title ?? ""} ${node.role ?? ""}`.toLowerCase();
  for (const [re, icon] of KEYWORDS) if (re.test(hay)) return icon;
  return TYPE_ICON[node.type] ?? Bot;
}
