'use client';

import {
  ArrowDown,
  ArrowUp,
  Circle,
  Diamond,
  Minus,
  Image as ImageIcon,
  Octagon,
  PenLine,
  Palette,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "../store";
import type { CanvasElement } from "../types";
import { AiInstructionPanel } from "./AiInstructionPanel";

type SidebarInspectorProps = {
  onRequestPalette: () => void;
  onRequestLayout: () => void;
};

export function SidebarInspector({ onRequestPalette, onRequestLayout }: SidebarInspectorProps) {
  const selectedId = useCanvasStore((state) => state.selectedId);
  const elements = useCanvasStore((state) => state.elements);
  const setSelectedId = useCanvasStore((state) => state.setSelectedId);
  const selectedElement = elements.find((element) => element.id === selectedId);
  const updateElement = useCanvasStore((state) => state.updateElement);
  const deleteElement = useCanvasStore((state) => state.deleteElement);
  const bringForward = useCanvasStore((state) => state.bringForward);
  const sendBackward = useCanvasStore((state) => state.sendBackward);
  const backgroundColor = useCanvasStore((state) => state.backgroundColor);
  const setBackgroundColor = useCanvasStore((state) => state.setBackgroundColor);

  const handleNumericChange = (field: keyof CanvasElement, value: number) => {
    if (!selectedElement) return;
    if (Number.isNaN(value)) return;
    updateElement(selectedElement.id, { [field]: value } as Partial<CanvasElement>);
  };

  const handleOpacityChange = (value: number) => {
    if (!selectedElement) return;
    updateElement(selectedElement.id, { opacity: value } as Partial<CanvasElement>);
  };

  const handleColorChange = (field: keyof CanvasElement, value: string) => {
    if (!selectedElement) return;
    updateElement(selectedElement.id, { [field]: value } as Partial<CanvasElement>);
  };

  const handleTextChange = (value: string) => {
    if (!selectedElement || selectedElement.type !== "text") return;
    updateElement(selectedElement.id, { text: value });
  };
  const fontOptions = [
    { label: "Inter", value: "Inter, sans-serif" },
    { label: "Work Sans", value: "\"Work Sans\", sans-serif" },
    { label: "Montserrat", value: "Montserrat, sans-serif" },
    { label: "Fira Sans", value: "\"Fira Sans\", sans-serif" },
    { label: "IBM Plex Sans", value: "\"IBM Plex Sans\", sans-serif" },
    { label: "Space Grotesk", value: "\"Space Grotesk\", sans-serif" },
    { label: "Nunito", value: "Nunito, sans-serif" },
    { label: "Roboto", value: "Roboto, sans-serif" },
    { label: "Playfair Display", value: "\"Playfair Display\", serif" },
    { label: "Lora", value: "Lora, serif" },
    { label: "Crimson Pro", value: "\"Crimson Pro\", serif" },
    { label: "Source Serif", value: "\"Source Serif 4\", serif" },
    { label: "IBM Plex Mono", value: "\"IBM Plex Mono\", monospace" },
    { label: "Courier New", value: "\"Courier New\", monospace" },
  ];

  const shapeTypes = new Set([
    "rect",
    "circle",
    "triangle",
    "pill",
    "star",
    "diamond",
    "octagon",
    "half-octagon",
  ]);
  const isShapeElement = selectedElement && shapeTypes.has(selectedElement.type);
  const isPathElement =
    selectedElement && (selectedElement.type === "line" || selectedElement.type === "freehand");
  const supportsCornerControls =
    selectedElement && ["rect", "pill"].includes(selectedElement.type);

  const layerIconMap: Record<CanvasElement["type"], LucideIcon> = {
    text: Type,
    rect: Square,
    pill: Square,
    circle: Circle,
    triangle: Triangle,
    star: Star,
    diamond: Diamond,
    octagon: Octagon,
    "half-octagon": Octagon,
    image: ImageIcon,
    line: Minus,
    freehand: PenLine,
  } as const;

  const layerLabelMap: Record<CanvasElement["type"], string> = {
    text: "Text layer",
    rect: "Card",
    pill: "Pill",
    circle: "Circle",
    triangle: "Triangle",
    star: "Star",
    diamond: "Diamond",
    octagon: "Octagon",
    "half-octagon": "Half octagon",
    image: "Image",
    line: "Line",
    freehand: "Freehand",
  } as const;

  const renderElementControls = () => {
    if (!selectedElement) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
          <p className="text-xs uppercase tracking-[0.3em]">No selection</p>
          <p className="mt-2">
            Select a layer on the canvas to edit its copy, colors, or layout. Use AI to auto-distribute elements when you feel stuck.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onRequestLayout}>
              Auto layout
            </Button>
            <Button size="sm" variant="outline" onClick={onRequestPalette}>
              Palette ideas
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Layer</p>
            <p className="font-semibold capitalize">{selectedElement.type}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => bringForward(selectedElement.id)} aria-label="Bring forward">
              <ArrowUp className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => sendBackward(selectedElement.id)} aria-label="Send backward">
              <ArrowDown className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => deleteElement(selectedElement.id)} aria-label="Delete element">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
        <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Opacity
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={selectedElement.opacity}
            onChange={(event) => handleOpacityChange(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        {selectedElement.type === "text" ? (
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Copy
              <textarea
                value={selectedElement.text}
                onChange={(event) => handleTextChange(event.target.value)}
                className="mt-2 h-24 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Font size
              <input
                type="number"
                min={8}
                max={200}
                value={selectedElement.fontSize}
                onChange={(event) => handleNumericChange("fontSize" as keyof CanvasElement, Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Font family
              <select
                value={
                  fontOptions.find((option) => option.value === selectedElement.fontFamily)?.value ||
                  selectedElement.fontFamily
                }
                onChange={(event) => handleColorChange("fontFamily" as keyof CanvasElement, event.target.value)}
                className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm capitalize"
              >
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Color
              <input
                type="color"
                value={selectedElement.fill}
                onChange={(event) => handleColorChange("fill" as keyof CanvasElement, event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-border/60 bg-card/80"
              />
            </label>
          </div>
        ) : null}
        {isShapeElement ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Width
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(event) => handleNumericChange("width", Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Height
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(event) => handleNumericChange("height", Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Fill
              <input
                type="color"
                value={selectedElement.fill}
                onChange={(event) => handleColorChange("fill", event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-border/60 bg-card/80"
              />
            </label>
            {supportsCornerControls ? (
              <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Corner radius
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={selectedElement.borderRadius ?? 0}
                  onChange={(event) =>
                    handleNumericChange("borderRadius" as keyof CanvasElement, Number(event.target.value))
                  }
                  className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm"
                />
              </label>
            ) : null}
          </div>
        ) : null}
        {isPathElement ? (
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Stroke color
              <input
                type="color"
                value={selectedElement.stroke ?? "#111827"}
                onChange={(event) => handleColorChange("stroke" as keyof CanvasElement, event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-border/60 bg-card/80"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Stroke width
              <input
                type="range"
                min={1}
                max={20}
                value={selectedElement.strokeWidth ?? 3}
                onChange={(event) =>
                  handleNumericChange("strokeWidth" as keyof CanvasElement, Number(event.target.value))
                }
                className="mt-2 w-full"
              />
            </label>
          </div>
        ) : null}
        {selectedElement.type === "image" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Width
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(event) => handleNumericChange("width", Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Height
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(event) => handleNumericChange("height", Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-border/60 bg-card/80 p-2 text-sm"
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="w-full rounded-3xl border border-border/60 bg-card/80 p-4 shadow-inner shadow-black/5 lg:w-72 xl:w-80">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Inspector</p>
          <h2 className="text-lg font-semibold">Properties</h2>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRequestPalette} aria-label="Suggest palette">
          <Palette className="size-4" />
        </Button>
      </div>
      <div className="mt-4 space-y-4 text-sm">
        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Background</p>
          <div className="mt-3 space-y-2">
            {backgroundColor !== "transparent" ? (
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
                className="h-10 w-full rounded-xl border border-border/60 bg-card/80"
              />
            ) : (
              <div className="flex h-10 w-full items-center justify-center rounded-xl border border-border/60 bg-[radial-gradient(circle,#94a3b8_1px,transparent_1px)] bg-[length:12px_12px] text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                transparent
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={backgroundColor === "transparent" ? "default" : "outline"}
                onClick={() => setBackgroundColor("transparent")}
              >
                Transparent
              </Button>
            <Button
              type="button"
              size="sm"
              variant={backgroundColor !== "transparent" ? "default" : "outline"}
              onClick={() => {
                if (backgroundColor === "transparent") {
                  setBackgroundColor("#f8fafc");
                }
              }}
            >
              Solid fill
            </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onRequestPalette}>
              Palette ideas
            </Button>
            <Button size="sm" variant="outline" onClick={onRequestLayout}>
              Auto layout
            </Button>
          </div>
        </div>
        {renderElementControls()}
        <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Layers</p>
              <p className="text-xs text-muted-foreground">Select, focus, delete</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{elements.length}</span>
          </div>
          {elements.length ? (
            <ul className="mt-3 max-h-48 space-y-2 overflow-auto">
              {elements.map((layer, index) => {
                const Icon =
                  layerIconMap[layer.type as keyof typeof layerIconMap] ?? Square;
                const label =
                  layerLabelMap[layer.type as keyof typeof layerLabelMap] ?? layer.type;
                const preview =
                  layer.type === "text" && layer.text
                    ? `“${layer.text.slice(0, 18)}${layer.text.length > 18 ? "…" : ""}”`
                    : null;
                const isActive = selectedElement?.id === layer.id;
                return (
                  <li
                    key={layer.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2",
                      isActive
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 bg-card/80 text-muted-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(layer.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <Icon className="size-4" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">{label}</span>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                          #{index + 1} {preview ? `· ${preview}` : null}
                        </span>
                      </div>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      onClick={() => deleteElement(layer.id)}
                      aria-label={`Delete ${label}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No layers yet. Add text, shapes, or images to see them listed here.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4">
          <AiInstructionPanel />
        </div>
      </div>
    </aside>
  );
}
