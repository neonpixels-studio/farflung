// Kept apart from theme.ts, which touches the DOM, so the server can import it.
export const ACCENT_COLORS = [
  "violet",
  "indigo",
  "blue",
  "emerald",
  "amber",
  "orange",
  "rose",
  "graphite",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];
