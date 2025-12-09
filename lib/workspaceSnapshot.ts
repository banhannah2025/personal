import { promises as fs } from "fs";
import path from "path";
import {
  ALLOWED_ENTRIES,
  MAX_FILE_BYTES,
  PROJECT_ROOT,
} from "@/lib/repoAccess";

export type WorkspaceFile = {
  path: string;
  size: number;
  mtimeMs: number;
  preview: string;
};

export type WorkspaceSnapshot = {
  generatedAt: string;
  files: WorkspaceFile[];
};

const PREVIEW_CHAR_LIMIT = 2000;
const SNAPSHOT_MAX_AGE = 15_000; // 15 seconds

let cachedSnapshot: { timestamp: number; data: WorkspaceSnapshot } | null = null;

export async function getWorkspaceSnapshot(
  forceRefresh = false
): Promise<WorkspaceSnapshot> {
  if (!forceRefresh && cachedSnapshot) {
    const age = Date.now() - cachedSnapshot.timestamp;
    if (age < SNAPSHOT_MAX_AGE) {
      return cachedSnapshot.data;
    }
  }

  const files: WorkspaceFile[] = [];
  for (const entry of ALLOWED_ENTRIES) {
    const absolute = path.join(PROJECT_ROOT, entry.relPath);
    try {
      const stat = await fs.stat(absolute);
      if (stat.isDirectory()) {
        await walkDirectory(absolute, entry.relPath, files);
      } else if (stat.isFile()) {
        const preview = await readPreview(absolute, stat.size);
        files.push({
          path: entry.relPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          preview,
        });
      }
    } catch (error) {
      console.warn(`Unable to index ${entry.relPath}`, error);
    }
  }

  const data: WorkspaceSnapshot = {
    generatedAt: new Date().toISOString(),
    files,
  };
  cachedSnapshot = { timestamp: Date.now(), data };
  return data;
}

async function walkDirectory(
  absoluteDir: string,
  relativeDir: string,
  collector: WorkspaceFile[]
) {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.join(relativeDir, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, relativePath, collector);
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolutePath);
      if (stat.size > MAX_FILE_BYTES) continue;
      const preview = await readPreview(absolutePath, stat.size);
      collector.push({
        path: relativePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        preview,
      });
    }
  }
}

async function readPreview(filePath: string, size: number) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    if (contents.length <= PREVIEW_CHAR_LIMIT) {
      return contents;
    }
    return contents.slice(0, PREVIEW_CHAR_LIMIT) + "\n... [truncated]";
  } catch (error) {
    console.warn(`Failed to read ${filePath}`, error);
    return `Unable to read file (size: ${size} bytes).`;
  }
}
