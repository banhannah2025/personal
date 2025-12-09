'use client';

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LayoutSuggestion } from "../types";

export type AiDialogMode = "image" | "palette" | "layout";

type ImageResult = { type: "image"; imageUrl: string; provider?: string };
type PaletteResult = { type: "palette"; colors: string[]; description?: string };
type LayoutResult = { type: "layout"; suggestion: LayoutSuggestion };

type AiResult = ImageResult | PaletteResult | LayoutResult;

type AiPromptDialogProps = {
  mode: AiDialogMode | null;
  open: boolean;
  onClose: () => void;
  onAddImage: (src: string) => void;
  onApplyPalette: (colors: string[]) => void;
  onApplyLayout: (suggestion: LayoutSuggestion) => void;
};

const endpointMap: Record<AiDialogMode, string> = {
  image: "/api/ai/generate-image",
  palette: "/api/ai/suggest-palette",
  layout: "/api/ai/suggest-layout",
};

const placeholderMap: Record<AiDialogMode, string> = {
  image: "Dreamy studio background with neon gradient",
  palette: "Earthy palette with clay, sage, midnight accents",
  layout: "Magazine hero with collage cards",
};

export function AiPromptDialog({
  mode,
  open,
  onClose,
  onAddImage,
  onApplyPalette,
  onApplyLayout,
}: AiPromptDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt("");
      setStatus("idle");
      setError(null);
      setResult(null);
    }
  }, [open, mode]);

  const title = useMemo(() => {
    if (!mode) return "AI assistant";
    if (mode === "image") return "Generate background";
    if (mode === "palette") return "Suggest palette";
    return "Auto layout";
  }, [mode]);

  if (!open || !mode) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError("Add a prompt to continue.");
      return;
    }
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const response = await fetch(endpointMap[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "AI request failed");
      }
      const data = await response.json();
      if (mode === "image") {
        setResult({ type: "image", imageUrl: data.imageUrl, provider: data.provider });
      } else if (mode === "palette") {
        setResult({ type: "palette", colors: data.colors ?? [], description: data.description });
      } else {
        setResult({ type: "layout", suggestion: data.layout });
      }
      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to reach AI endpoint.");
      setStatus("error");
    }
  };

  const handleApplyResult = () => {
    if (!result) return;
    if (result.type === "image") {
      onAddImage(result.imageUrl);
      onClose();
    } else if (result.type === "palette") {
      onApplyPalette(result.colors);
      onClose();
    } else {
      onApplyLayout(result.suggestion);
      onClose();
    }
  };

  const actionLabel = result?.type === "image"
    ? "Add to canvas"
    : result?.type === "palette"
      ? "Apply palette"
      : "Apply layout";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI assist</p>
            <h2 className="text-2xl font-semibold">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close AI assistant">
            <X className="size-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={placeholderMap[mode]}
              className="mt-2 h-28 w-full rounded-2xl border border-border/60 bg-background/70 p-3 text-sm text-foreground"
            />
          </label>
          {error ? (
            <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={status === "loading"}>
              {status === "loading" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Run AI
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
        {result ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4">
            {result.type === "image" ? (
              <div className="space-y-3">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60">
                  <Image
                    src={result.imageUrl}
                    alt="AI generated preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 512px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                {result.provider ? (
                  <p className="text-xs text-muted-foreground">Source: {result.provider}</p>
                ) : null}
              </div>
            ) : null}
            {result.type === "palette" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {result.colors.map((color) => (
                    <div key={color} className="rounded-xl border border-border/40 p-3 text-[10px] text-muted-foreground" style={{ backgroundColor: color }}>
                      {color.toUpperCase()}
                    </div>
                  ))}
                </div>
                {result.description ? (
                  <p className="text-xs text-muted-foreground">{result.description}</p>
                ) : null}
              </div>
            ) : null}
            {result.type === "layout" ? (
              <div className="space-y-3 text-sm">
                <p className="font-semibold capitalize">{result.suggestion.pattern} layout</p>
                <p className="text-muted-foreground">{result.suggestion.description}</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {result.suggestion.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button type="button" onClick={handleApplyResult} disabled={status === "loading"}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
