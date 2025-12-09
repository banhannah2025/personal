'use client';

import { useEffect, useState } from "react";
import { DEFAULT_GPT51_MODEL, GPT51_MODELS, type Gpt51Model } from "@/lib/models";
import {
  DEFAULT_REASONING_LEVEL,
  REASONING_LEVELS,
  type ReasoningLevelId,
} from "@/lib/reasoning";

type FileAction = "edit" | "add" | "delete";

type AssistantPlan = {
  overview: string;
  file_operations: Array<{
    action: FileAction;
    path: string;
    summary: string;
    code?: string;
    location?: string;
  }>;
  additional_notes?: string;
};

type AssistantMemoryEntry = {
  id: string;
  prompt: string;
  response: AssistantPlan;
  model: string;
  reasoning: string;
  createdAt: string;
};

export default function AssistantConsole() {
  const [history, setHistory] = useState<AssistantMemoryEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<Gpt51Model>(DEFAULT_GPT51_MODEL);
  const [selectedReasoning, setSelectedReasoning] = useState<ReasoningLevelId>(
    DEFAULT_REASONING_LEVEL.id
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const loadHistory = async () => {
      try {
        const response = await fetch("/api/assistant");
        if (!response.ok) throw new Error("Failed to load history");
        const data = (await response.json()) as { history: AssistantMemoryEntry[] };
        if (!ignore) {
          setHistory(data.history);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadHistory();
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Describe what you want the AI to do.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmed,
          model: selectedModel,
          reasoning: selectedReasoning,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Assistant call failed");
      }
      const data = (await response.json()) as {
        plan: AssistantPlan;
        model: string;
      };
      const newEntry: AssistantMemoryEntry = {
        id: crypto.randomUUID(),
        prompt: trimmed,
        response: data.plan,
        model: data.model,
        reasoning: selectedReasoning,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [newEntry, ...prev]);
      setPrompt("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Assistant call failed");
    } finally {
      setLoading(false);
    }
  };

  const currentReasoningMeta =
    REASONING_LEVELS.find((level) => level.id === selectedReasoning) ??
    DEFAULT_REASONING_LEVEL;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Conversational planner
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Describe features or fixes in natural language. The AI inspects the workspace snapshot
          and returns the files to edit or create.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
        <p>
          Model:{" "}
          <span className="font-semibold text-foreground">
            {selectedModel}
          </span>
        </p>
        <p>
          Reasoning:{" "}
          <span className="font-semibold text-foreground">
            {currentReasoningMeta.label}
          </span>{" "}
          · {currentReasoningMeta.description}
        </p>
      </div>
      <textarea
        className="min-h-[120px] w-full rounded-lg border border-border bg-transparent p-3 text-sm text-foreground outline-none focus:border-primary"
        placeholder="E.g. “Add a theme toggle to the header and dark-mode styles for the landing page.”"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        disabled={loading}
      />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Model
          </label>
          <select
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value as Gpt51Model)}
            disabled={loading}
          >
            {GPT51_MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reasoning
          </label>
          <select
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={selectedReasoning}
            onChange={(event) =>
              setSelectedReasoning(event.target.value as ReasoningLevelId)
            }
            disabled={loading}
          >
            {REASONING_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask Codex"}
        </button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="space-y-4">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No conversations yet. Ask for a change to see Codex&apos;s plan.
          </p>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="space-y-3 rounded-xl border border-border bg-card/80 p-4"
            >
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Prompt · {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-foreground">{entry.prompt}</p>
                <p className="text-xs text-muted-foreground">
                  Model {entry.model} · Reasoning {entry.reasoning}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Plan
                </p>
                <p className="text-sm text-muted-foreground">
                  {entry.response.overview}
                </p>
                <div className="space-y-3">
                  {entry.response.file_operations.map((operation, index) => (
                    <div
                      key={`${operation.path}-${index}`}
                      className="space-y-2 rounded-lg border border-border bg-background/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            operation.action === "edit"
                              ? "bg-amber-200/40 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100"
                              : operation.action === "add"
                                ? "bg-emerald-200/40 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100"
                                : "bg-rose-200/40 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100"
                          }`}
                        >
                          {operation.action === "edit"
                            ? "Edit file"
                            : operation.action === "add"
                              ? "Add file"
                              : "Delete file"}
                        </span>
                        <span className="truncate text-xs font-mono text-muted-foreground">
                          {operation.path}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {operation.summary}
                      </p>
                      {operation.location ? (
                        <p className="text-xs text-muted-foreground">
                          Location: {operation.location}
                        </p>
                      ) : null}
                      {operation.code ? (
                        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
                          <code className="whitespace-pre-wrap break-words">{operation.code}</code>
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
                {entry.response.additional_notes ? (
                  <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    {entry.response.additional_notes}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
