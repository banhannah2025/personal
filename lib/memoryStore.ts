import { promises as fs } from "fs";
import path from "path";
import { PROJECT_ROOT } from "@/lib/repoAccess";

export type AssistantMemoryEntry = {
  id: string;
  prompt: string;
  response: unknown;
  model: string;
  reasoning: string;
  createdAt: string;
};

const MEMORY_DIR = path.join(PROJECT_ROOT, "data");
const MEMORY_PATH = path.join(MEMORY_DIR, "assistant-memory.json");

export async function readMemory(): Promise<AssistantMemoryEntry[]> {
  try {
    const raw = await fs.readFile(MEMORY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as AssistantMemoryEntry[];
    }
    return [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error("Failed to read assistant memory", error);
    return [];
  }
}

export async function appendMemory(entry: AssistantMemoryEntry) {
  const existing = await readMemory();
  existing.unshift(entry);
  await ensureMemoryDir();
  await fs.writeFile(MEMORY_PATH, JSON.stringify(existing.slice(0, 25), null, 2), "utf8");
}

async function ensureMemoryDir() {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create memory directory", error);
  }
}
