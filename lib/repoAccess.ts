import path from "path";

export type AllowedEntry = {
  type: "dir" | "file";
  name: string;
  relPath: string;
};

export const PROJECT_ROOT = process.cwd();
export const MAX_FILE_BYTES = 200 * 1024;

export const ALLOWED_ENTRIES: AllowedEntry[] = [
  { type: "dir", name: "App Router", relPath: "app" },
  { type: "dir", name: "Public Assets", relPath: "public" },
  { type: "file", name: "package.json", relPath: "package.json" },
  { type: "file", name: "next.config.ts", relPath: "next.config.ts" },
  { type: "file", name: "tsconfig.json", relPath: "tsconfig.json" },
  { type: "file", name: "postcss.config.mjs", relPath: "postcss.config.mjs" },
  { type: "file", name: "eslint.config.mjs", relPath: "eslint.config.mjs" },
  { type: "file", name: "pnpm-lock.yaml", relPath: "pnpm-lock.yaml" },
  { type: "file", name: "README.md", relPath: "README.md" },
];

export function resolveSafePath(requestedPath: string) {
  const normalized = path.posix.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized) {
    throw new Error("Invalid path");
  }

  const segments = normalized.split("/").filter(Boolean);
  const rootSegment = segments[0];
  const allowed = ALLOWED_ENTRIES.find((entry) => entry.relPath === rootSegment);
  if (!allowed) {
    throw new Error("Path outside the readable area");
  }

  if (allowed.type === "file" && segments.length > 1) {
    throw new Error("Invalid traversal beyond file boundary");
  }

  const absoluteRoot = path.join(PROJECT_ROOT, allowed.relPath);
  const absolutePath =
    segments.length === 1
      ? absoluteRoot
      : path.join(absoluteRoot, ...segments.slice(1));

  if (!absolutePath.startsWith(absoluteRoot)) {
    throw new Error("Path traversal detected");
  }

  const relativePath =
    segments.length === 1
      ? allowed.relPath
      : [allowed.relPath, ...segments.slice(1)].join("/");

  return {
    absolutePath,
    relativePath,
    root: allowed,
  };
}

export function pathRelativeToProject(target: string) {
  return path.relative(PROJECT_ROOT, target).split(path.sep).join("/");
}

export function isWithinAllowedRoots(relativePath: string) {
  if (!relativePath) return false;
  const normalized = relativePath.split(path.sep).join("/");
  const rootSegment = normalized.split("/")[0];
  return ALLOWED_ENTRIES.some((entry) => entry.relPath === rootSegment);
}
