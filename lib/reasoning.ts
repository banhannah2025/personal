export const REASONING_LEVELS = [
  {
    id: "fast",
    label: "Fast",
    description: "Quick validation with low reasoning budget",
    maxOutputTokens: 800,
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Default depth with moderate reasoning cost",
    maxOutputTokens: 2000,
  },
  {
    id: "deep",
    label: "Deep",
    description: "Thorough reasoning and longer outputs",
    maxOutputTokens: 4000,
  },
] as const;

export type ReasoningLevelId = (typeof REASONING_LEVELS)[number]["id"];

export const DEFAULT_REASONING_LEVEL = REASONING_LEVELS[1];

export function getReasoningLevel(id?: ReasoningLevelId) {
  if (!id) return DEFAULT_REASONING_LEVEL;
  return REASONING_LEVELS.find((level) => level.id === id) ?? DEFAULT_REASONING_LEVEL;
}
