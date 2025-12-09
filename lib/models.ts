export const GPT51_MODELS = [
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5.1-codex-mini",
  "gpt-5.1-chat-latest",
  "gpt-5.1-2025-11-13",
] as const;

export type Gpt51Model = (typeof GPT51_MODELS)[number];

export const DEFAULT_GPT51_MODEL: Gpt51Model = GPT51_MODELS[0];
