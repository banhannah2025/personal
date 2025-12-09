'use client';

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "../store";
import type { CanvasElement } from "../types";

type AiInstructionPanelProps = {
  className?: string;
};

export function AiInstructionPanel({ className }: AiInstructionPanelProps) {
  const applyEdits = useCanvasStore((state) => state.applyEdits);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const instructions = prompt.trim();
    if (!instructions) {
      setError("Add an instruction before running the AI editor.");
      return;
    }
    setStatus("loading");
    setError(null);
    setNotes(null);
    const { elements } = useCanvasStore.getState();
    try {
      const response = await fetch("/api/ai/canvas-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: instructions, elements }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "AI edit failed");
      }
      const payload = (await response.json()) as {
        edits?: Array<{ id: string; updates: Partial<CanvasElement> }>;
        notes?: string;
      };
      if (Array.isArray(payload.edits) && payload.edits.length > 0) {
        applyEdits(payload.edits);
      }
      setNotes(payload.notes ?? (payload.edits?.length ? "Applied AI changes" : "No changes applied"));
      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "AI edit failed");
      setStatus("error");
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI editor</p>
          <h3 className="text-sm font-semibold">Describe an edit</h3>
        </div>
        <Sparkles className="size-4 text-primary" />
      </div>
      <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. align the cards, make the hero text white"
          className="h-24 w-full rounded-2xl border border-border/60 bg-card/70 p-3 text-sm text-foreground"
        />
        {error ? (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {notes && !error ? (
          <p className="rounded-2xl border border-border/40 bg-background/70 p-2 text-xs text-muted-foreground">
            {notes}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={status === "loading"}>
            {status === "loading" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Applying
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Run edit
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setPrompt("");
              setError(null);
              setNotes(null);
              setStatus("idle");
            }}
          >
            Clear
          </Button>
        </div>
      </form>
    </div>
  );
}
