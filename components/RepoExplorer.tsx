'use client';

import { useEffect, useMemo, useState } from "react";

type RootEntry = {
  label: string;
  path: string;
  type: "dir" | "file";
};

type DirectoryItem = {
  name: string;
  path: string;
  type: "dir" | "file";
  size?: number;
};

type FileResponse = {
  path: string;
  content: string;
};

type RepoApiPayload =
  | { action: "roots" }
  | { action: "list"; path: string }
  | { action: "read"; path: string };

export default function RepoExplorer() {
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [directoryItems, setDirectoryItems] = useState<DirectoryItem[]>([]);
  const [dirError, setDirError] = useState<string | null>(null);
  const [dirLoading, setDirLoading] = useState(false);
  const [file, setFile] = useState<FileResponse | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await callRepoApi<{ roots: RootEntry[] }>({ action: "roots" });
        if (!ignore) {
          setRoots(data.roots);
        }
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!currentDir) {
      setDirectoryItems([]);
      setDirError(null);
      return;
    }

    let ignore = false;
    setDirLoading(true);
    setDirError(null);

    (async () => {
      try {
        const data = await callRepoApi<{ items: DirectoryItem[] }>({
          action: "list",
          path: currentDir,
        });
        if (!ignore) {
          setDirectoryItems(
            data.items.sort((a, b) => {
              if (a.type === b.type) {
                return a.name.localeCompare(b.name);
              }
              return a.type === "dir" ? -1 : 1;
            })
          );
        }
      } catch (error) {
        if (!ignore) {
          setDirError("Unable to load directory");
          console.error(error);
        }
      } finally {
        if (!ignore) {
          setDirLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [currentDir]);

  const breadcrumbs = useMemo(() => {
    if (!currentDir) return [];
    const parts = currentDir.split("/");
    return parts.map((part, idx) => ({
      label: part,
      path: parts.slice(0, idx + 1).join("/"),
    }));
  }, [currentDir]);

  const handleRootPick = (entry: RootEntry) => {
    if (entry.type === "dir") {
      setCurrentDir(entry.path);
    } else {
      readFile(entry.path);
    }
  };

  const handleDirectoryItem = (item: DirectoryItem) => {
    if (item.type === "dir") {
      setCurrentDir(item.path);
    } else {
      readFile(item.path);
    }
  };

  const readFile = async (path: string) => {
    setFileLoading(true);
    setFileError(null);
    try {
      const data = await callRepoApi<FileResponse>({ action: "read", path });
      setFile(data);
    } catch (error) {
      console.error(error);
      setFileError("Unable to load file contents");
    } finally {
      setFileLoading(false);
    }
  };

  const handleGoUp = () => {
    if (!currentDir) return;
    const segments = currentDir.split("/");
    segments.pop();
    if (segments.length === 0) {
      setCurrentDir(null);
    } else {
      setCurrentDir(segments.join("/"));
    }
  };

  const listTitle = currentDir ? `/${currentDir}` : "Repository roots";
  const items: (DirectoryItem | RootEntry)[] = currentDir ? directoryItems : roots;

  return (
    <div className="space-y-4 text-foreground">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{listTitle}</p>
          {currentDir ? (
            <button
              onClick={handleGoUp}
              className="text-xs font-semibold uppercase tracking-wide text-primary hover:opacity-80"
            >
              Up
            </button>
          ) : null}
        </div>
        {breadcrumbs.length > 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.path}>
                {crumb.label}
                {idx < breadcrumbs.length - 1 ? " / " : ""}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-2 text-sm">
          {currentDir && dirLoading ? (
            <p className="text-muted-foreground">Loading directory…</p>
          ) : null}
          {dirError ? <p className="text-destructive">{dirError}</p> : null}
          <ul className="space-y-1">
            {items.map((item) => {
              const displayName = "name" in item ? item.name : item.label;
              const size =
                !currentDir || item.type === "dir"
                  ? undefined
                  : "size" in item
                    ? item.size
                    : undefined;
              const sizeLabel = size ? `${Math.ceil(size / 1024)}kb` : null;
              return (
                <li key={item.path}>
                  <button
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-muted"
                    onClick={() =>
                      currentDir
                        ? handleDirectoryItem(item as DirectoryItem)
                        : handleRootPick(item as RootEntry)
                    }
                  >
                    <span className="font-medium">
                      {item.type === "dir" ? "📁 " : "📄 "}
                      {displayName}
                    </span>
                      {sizeLabel ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {sizeLabel}
                        </span>
                      ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries to show.</p>
          ) : null}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            File preview
          </p>
          {file ? (
            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {file.path}
            </span>
          ) : null}
        </div>
        {fileLoading ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Loading file…
          </div>
        ) : file ? (
          <pre className="mt-3 max-h-[60vh] w-full overflow-auto rounded-xl bg-muted p-4 text-sm text-foreground">
            <code className="whitespace-pre-wrap break-words">{file.content}</code>
          </pre>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Choose a file to inspect from the list above.
          </div>
        )}
        {fileError ? <p className="mt-2 text-sm text-destructive">{fileError}</p> : null}
      </section>
    </div>
  );
}

async function callRepoApi<T>(payload: RepoApiPayload): Promise<T> {
  const response = await fetch("/api/repo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
