import OpenAI from "openai";
import Groq from "groq-sdk";

const openaiApiKey = process.env.OPENAI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!openaiApiKey) {
  console.warn("[aiClients] Missing OPENAI_API_KEY. AI calls will fail until it is set.");
}

if (!groqApiKey) {
  console.warn("[aiClients] Missing GROQ_API_KEY. Groq calls will fail until it is set.");
}

export const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
export const groqClient = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

export const DEFAULT_COMPLETION_MODEL = process.env.OPENAI_TRAINING_MODEL ?? "gpt-5.1";
export const DEFAULT_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
export const DEFAULT_GROQ_MODEL = process.env.GROQ_TRAINING_MODEL ?? "llama-3.1-70b-versatile";
