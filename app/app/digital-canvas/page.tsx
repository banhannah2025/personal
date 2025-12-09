'use client';

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Stage as StageType } from "konva/lib/Stage";
import { CanvasStage } from "./components/CanvasStage";
import { SidebarElements } from "./components/SidebarElements";
import { SidebarInspector } from "./components/SidebarInspector";
import { TopBar } from "./components/TopBar";
import { AiPromptDialog, type AiDialogMode } from "./components/AiPromptDialog";
import { useCanvasStore } from "./store";
import type { CanvasElement, LayoutSuggestion } from "./types";

export default function DigitalCanvasPage() {
  const stageRef = useRef<StageType>(null);
  const [dialogMode, setDialogMode] = useState<AiDialogMode | null>(null);

  const openDialog = (mode: AiDialogMode) => setDialogMode(mode);
  const closeDialog = () => setDialogMode(null);

  const handleAddGeneratedImage = (src: string) => {
    useCanvasStore.getState().addElement("image", { src });
  };

  const handleApplyPalette = (colors: string[]) => {
    const palette = colors.length ? colors : ["#0f172a", "#1e1b4b", "#0ea5e9"];
    const store = useCanvasStore.getState();
    store.setBackgroundColor(palette[0]);
    const updated = store.elements.map((element, index) => {
      if (element.type === "rect" || element.type === "text") {
        const color = palette[index % palette.length];
        return { ...element, fill: color };
      }
      return element;
    });
    store.replaceElements(updated);
  };

  const handleApplyLayout = (suggestion: LayoutSuggestion) => {
    const store = useCanvasStore.getState();
    if (store.elements.length === 0) {
      return;
    }
    const next = arrangeElements(store.elements, suggestion, store.canvasWidth, store.canvasHeight);
    store.replaceElements(next);
    store.setSelectedId(null);
  };

  const layoutTip = useMemo(() => {
    return "Prompt Digital Canvas to auto-layout or suggest palettes. Everything stays inside this workspace.";
  }, []);
  const backgroundColor = useCanvasStore((state) => state.backgroundColor);
  const [activeTool, setActiveTool] = useState<"default" | "line" | "freehand" | "eraser">("default");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [eraserWidth, setEraserWidth] = useState(20);
  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Arts & Crafts</p>
          <h1 className="text-3xl font-semibold">Digital Canvas</h1>
          <p className="text-sm text-muted-foreground">
            Build graphics, scene boards, and ritual cards with drag-and-drop elements plus AI helpers for imagery, color, and layout.
          </p>
          <p className="text-xs text-muted-foreground">{layoutTip}</p>
        </div>
        <div className="mt-5 flex flex-col gap-4 rounded-4xl border border-border/60 bg-background/80 p-4 shadow-inner shadow-black/20">
          <TopBar
            stageRef={stageRef}
            onOpenDialog={openDialog}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            eraserWidth={eraserWidth}
            onEraserWidthChange={setEraserWidth}
          />
          <div className="flex flex-col gap-4 lg:flex-row">
            <SidebarElements onOpenAiAssets={() => openDialog("image")} />
            <div
              className={cn(
                "flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/80",
                backgroundColor === "transparent" &&
                  "bg-[radial-gradient(circle,#f8fafc_1px,transparent_1px)] bg-[length:20px_20px]"
              )}
            >
              <CanvasStage
                ref={stageRef}
                activeTool={activeTool}
                strokeWidth={strokeWidth}
                eraserWidth={eraserWidth}
              />
            </div>
            <SidebarInspector
              onRequestPalette={() => openDialog("palette")}
              onRequestLayout={() => openDialog("layout")}
            />
          </div>
        </div>
      </section>
      <AiPromptDialog
        mode={dialogMode}
        open={dialogMode !== null}
        onClose={closeDialog}
        onAddImage={handleAddGeneratedImage}
        onApplyPalette={handleApplyPalette}
        onApplyLayout={handleApplyLayout}
      />
    </div>
  );
}

function arrangeElements(
  elements: CanvasElement[],
  suggestion: LayoutSuggestion,
  canvasWidth: number,
  canvasHeight: number
): CanvasElement[] {
  const margin = 64;

  const applyPosition = (element: CanvasElement, x: number, y: number, rotation = 0) => ({
    ...element,
    x,
    y,
    rotation,
  });

  const applySize = (element: CanvasElement, width: number, height: number) => {
    if (element.type === "rect") {
      return { ...element, width, height };
    }
    if (element.type === "image") {
      return { ...element, width, height };
    }
    return element;
  };

  if (suggestion.pattern === "grid") {
    const columns = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(elements.length))));
    const rows = Math.ceil(elements.length / columns);
    const cellWidth = (canvasWidth - margin * 2) / columns;
    const cellHeight = (canvasHeight - margin * 2) / rows;
    return elements.map((element, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + column * cellWidth + cellWidth * 0.1;
      const y = margin + row * cellHeight + cellHeight * 0.1;
      const positioned = applyPosition(element, x, y, 0);
      if (element.type === "rect" || element.type === "image") {
        return applySize(positioned, cellWidth * 0.8, cellHeight * 0.8);
      }
      return positioned;
    });
  }

  if (suggestion.pattern === "hero") {
    const heroHeight = canvasHeight * 0.45;
    const gutter = 32;
    const heroWidth = canvasWidth - margin * 2;
    return elements.map((element, index) => {
      if (index === 0) {
        const positioned = applyPosition(element, margin, margin, 0);
        return element.type === "rect" || element.type === "image"
          ? applySize(positioned, heroWidth, heroHeight)
          : positioned;
      }
      const columns = 3;
      const columnWidth = (canvasWidth - margin * 2 - gutter * (columns - 1)) / columns;
      const rowIndex = index - 1;
      const column = rowIndex % columns;
      const targetX = margin + column * (columnWidth + gutter);
      const targetY =
        margin + heroHeight + gutter + Math.floor(rowIndex / columns) * (columnWidth * 0.75 + gutter);
      const positioned = applyPosition(element, targetX, targetY, 0);
      if (element.type === "rect" || element.type === "image") {
        return applySize(positioned, columnWidth, columnWidth * 0.75);
      }
      return positioned;
    });
  }

  return elements.map((element, index) => {
    const xOffset = (index * 160) % Math.max(200, canvasWidth - margin * 2);
    const yOffset = ((index * 120) % Math.max(200, canvasHeight - margin * 2)) / 1.2;
    const angle = ((index % 5) - 2) * 4;
    const positioned = applyPosition(element, margin + xOffset, margin + yOffset, angle);
    if (element.type === "rect" || element.type === "image") {
      const maxWidth = canvasWidth * 0.35;
      const maxHeight = canvasHeight * 0.3;
      return applySize(positioned, maxWidth, maxHeight);
    }
    return positioned;
  });
}
