'use client';

import { useCallback } from "react";
import type { Stage as StageType } from "konva/lib/Stage";
import { Brush, Download, Eraser, ImagePlus, Minus, Palette, Sparkles, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "../store";
import type { AiDialogMode } from "./AiPromptDialog";

type TopBarProps = {
  stageRef: React.RefObject<StageType | null>;
  onOpenDialog: (mode: AiDialogMode) => void;
  activeTool: "default" | "line" | "freehand" | "eraser";
  onToolChange: (tool: "default" | "line" | "freehand" | "eraser") => void;
  strokeWidth: number;
  onStrokeWidthChange: (value: number) => void;
  eraserWidth: number;
  onEraserWidthChange: (value: number) => void;
};

export function TopBar({
  stageRef,
  onOpenDialog,
  activeTool,
  onToolChange,
  strokeWidth,
  onStrokeWidthChange,
  eraserWidth,
  onEraserWidthChange,
}: TopBarProps) {
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const elementsCount = useCanvasStore((state) => state.elements.length);

  const handleExport = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({
      pixelRatio: 2,
      mimeType: "image/png",
      quality: 1,
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `digital-canvas-${Date.now()}.png`;
    link.click();
  }, [stageRef]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 shadow-inner shadow-black/10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Digital Canvas</p>
        <h1 className="text-xl font-semibold">Mini studio</h1>
        <p className="text-xs text-muted-foreground">{elementsCount} layer{elementsCount === 1 ? "" : "s"} on stage</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo}>
          <Undo2 className="size-4" />
          Undo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={redo}>
          <Redo2 className="size-4" />
          Redo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-4" />
          Download PNG
        </Button>
        <Button
          type="button"
          variant={activeTool === "line" ? "default" : "outline"}
          size="sm"
          onClick={() => onToolChange(activeTool === "line" ? "default" : "line")}
        >
          <Minus className="size-4" />
          Line tool
        </Button>
        <Button
          type="button"
          variant={activeTool === "freehand" ? "default" : "outline"}
          size="sm"
          onClick={() => onToolChange(activeTool === "freehand" ? "default" : "freehand")}
        >
          <Brush className="size-4" />
          Freehand
        </Button>
        <Button
          type="button"
          variant={activeTool === "eraser" ? "default" : "outline"}
          size="sm"
          onClick={() => onToolChange(activeTool === "eraser" ? "default" : "eraser")}
        >
          <Eraser className="size-4" />
          Eraser
        </Button>
        <Button type="button" size="sm" onClick={() => onOpenDialog("image")}>
          <ImagePlus className="size-4" />
          Background
        </Button>
        <Button type="button" size="sm" onClick={() => onOpenDialog("palette")}>
          <Palette className="size-4" />
          Palette
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onOpenDialog("layout")}>
          <Sparkles className="size-4" />
          Layout AI
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Stroke</span>
          <input
            type="range"
            min={1}
            max={20}
            value={strokeWidth}
            onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
          />
          <span className="text-xs text-muted-foreground w-6 text-right">{strokeWidth}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Eraser</span>
          <input
            type="range"
            min={5}
            max={40}
            value={eraserWidth}
            onChange={(event) => onEraserWidthChange(Number(event.target.value))}
          />
          <span className="text-xs text-muted-foreground w-6 text-right">{eraserWidth}px</span>
        </div>
      </div>
    </header>
  );
}
