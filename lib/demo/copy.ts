/**
 * All user-facing copy for the public `/try` demo + its conversion gates (Prompts 13–14), in one
 * place so wording is easy to tune. Keep it short, calm, and inviting — the wall sells, never scolds.
 */
export const DEMO_COPY = {
  badge: "Live demo · no sign-up",
  signupHref: "/signup",
  signupCta: "Sign up free",

  // Gates (Prompt 14) — show the value, then ask. No rejection styling.
  editGate: "Sign up free to edit this.",
  saveGate: "Sign up free to save your own.",
  exportGate: "Sign up free to export.",

  // Soft nudge (Prompt 14) — slides in once, after real exploration.
  nudge: "Enjoying this? Spin up your own — it's free.",
  nudgeCta: "Make my own →",

  // Chat chips (pre-baked, no AI call).
  chips: {
    advanced: "Make it advanced",
    simple: "Back to simple",
    explain: "Explain this trace",
    scorer: "Add a scorer",
  },
} as const;

/** Pre-baked chat responses (no network). `explain` is filled from the cached trace at call time. */
export const DEMO_CHAT_REPLIES = {
  advanced:
    "Opening up the crew — the single research agent becomes five teams (Source, Analysis, Scoring, Synthesis, Composer) that hand off compressed packets between each other. Watch the canvas expand.",
  simple:
    "Collapsing back to the single-agent shape — same job, one brain instead of a department. Good for seeing the core loop without the team structure.",
  scorer:
    "In your own copy you'd drop an evaluator node after Synthesis to grade each draft on rigor and bias-risk, then route low scores back for another pass. Sign up to add and wire it.",
} as const;
