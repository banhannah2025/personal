import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  ALLOWED_ENTRIES,
  MAX_FILE_BYTES,
  isWithinAllowedRoots,
  pathRelativeToProject,
  resolveSafePath,
} from "@/lib/repoAccess";

type RepoRequest =
  | { action: "roots" }
  | { action: "list"; path: string }
  | { action: "read"; path: string };

type DirectoryItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RepoRequest;
    if (!body || typeof body !== "object" || !("action" in body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (body.action === "roots") {
      return NextResponse.json({
        roots: ALLOWED_ENTRIES.map((entry) => ({
          label: entry.name,
          type: entry.type,
          path: entry.relPath,
        })),
      });
    }

    if (!("path" in body) || !body.path) {
      return NextResponse.json(
        { error: "Path is required for this action" },
        { status: 400 }
      );
    }

    const resolved = resolveSafePath(body.path);

    if (body.action === "list") {
      const stat = await fs.stat(resolved.absolutePath);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: "Requested path is not a directory" },
          { status: 400 }
        );
      }

      const entries = await fs.readdir(resolved.absolutePath, {
        withFileTypes: true,
      });

      const mapped: DirectoryItem[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const entryPath = path.join(resolved.absolutePath, entry.name);
        const relativePath = pathRelativeToProject(entryPath);
        if (!isWithinAllowedRoots(relativePath)) continue;

        const item: DirectoryItem = {
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? "dir" : "file",
        };
        if (!entry.isDirectory()) {
          const entryStat = await fs.stat(entryPath);
          item.size = entryStat.size;
        }
        mapped.push(item);
      }

      return NextResponse.json({ items: mapped });
    }

    if (body.action === "read") {
      const stat = await fs.stat(resolved.absolutePath);
      if (!stat.isFile()) {
        return NextResponse.json(
          { error: "Requested path is not a file" },
          { status: 400 }
        );
      }

      if (stat.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "File exceeds size limit" },
          { status: 400 }
        );
      }

      const content = await fs.readFile(resolved.absolutePath, "utf8");
      return NextResponse.json({
        path: resolved.relativePath,
        content,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 });
  }
}
