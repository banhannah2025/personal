'use client';

import { useMemo, useRef } from "react";
import {
  Circle,
  Diamond,
  ImagePlus,
  Minus,
  Octagon,
  PenLine,
  RectangleHorizontal,
  RotateCcw,
  Sparkles,
  Square,
  Star,
  Triangle,
  Type,
} from "lucide-react";
import { HalfOctagonIcon } from "./icons/HalfOctagonIcon";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "../store";
import type { ElementKind, CanvasElement } from "../types";

type SidebarElementsProps = {
  onOpenAiAssets: () => void;
};

export function SidebarElements({ onOpenAiAssets }: SidebarElementsProps) {
  const addElement = useCanvasStore((state) => state.addElement);
  const reset = useCanvasStore((state) => state.reset);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      addElement("image", { src });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const addText = (presets?: Partial<CanvasElement>) => addElement("text", presets);
  const addShape = (type: ElementKind) => addElement(type);

  const shapeOptions = useMemo(
    () => [
      { id: "rect" as ElementKind, label: "Card", icon: Square },
      { id: "circle" as ElementKind, label: "Circle", icon: Circle },
      { id: "pill" as ElementKind, label: "Pill", icon: RectangleHorizontal },
      { id: "triangle" as ElementKind, label: "Triangle", icon: Triangle },
      { id: "star" as ElementKind, label: "Star", icon: Star },
      { id: "diamond" as ElementKind, label: "Diamond", icon: Diamond },
      { id: "octagon" as ElementKind, label: "Octagon", icon: Octagon },
      { id: "half-octagon" as ElementKind, label: "Half Octagon", icon: HalfOctagonIcon },
      { id: "line" as ElementKind, label: "Line", icon: Minus },
      { id: "freehand" as ElementKind, label: "Freehand", icon: PenLine },
    ],
    []
  );

  return (
    <aside className="w-full rounded-3xl border border-border/60 bg-card/80 p-4 shadow-inner shadow-black/5 lg:w-64 xl:w-72">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Elements</p>
          <h2 className="text-lg font-semibold">Toolbox</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={reset}
          aria-label="Clear canvas"
          title="Clear canvas"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        <div className="space-y-2 rounded-2xl border border-border/60 bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Text styles</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() =>
                addText({ fontSize: 48, fontFamily: "Playfair Display, serif", text: "Hero headline" })
              }
            >
              <Type className="size-4" />
              Heading
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() =>
                addText({ fontSize: 28, fontFamily: "Space Grotesk, sans-serif", text: "Subheading" })
              }
            >
              <Type className="size-4" />
              Subhead
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() =>
                addText({ fontSize: 18, fontFamily: "Inter, sans-serif", text: "Body copy goes here" })
              }
            >
              <Type className="size-4" />
              Body
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() =>
                addText({ fontSize: 14, fontFamily: "\"IBM Plex Mono\", monospace", text: "Caption / tag" })
              }
            >
              <Type className="size-4" />
              Caption
            </Button>
          </div>
        </div>
        <div className="space-y-2 rounded-2xl border border-border/60 bg-background/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Shapes</p>
          <div className="grid grid-cols-4 gap-2">
            {shapeOptions.map(({ id, icon: Icon }) => (
              <Button key={id} type="button" variant="outline" size="icon-sm" onClick={() => addShape(id)}>
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>
        <Button className="w-full justify-start" variant="outline" onClick={handleUploadClick}>
          <ImagePlus className="size-4" />
          Upload image
        </Button>
        <Button className="w-full justify-start" onClick={onOpenAiAssets}>
          <Sparkles className="size-4" />
          AI assets
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-border/70 bg-background/80 p-3 text-xs text-muted-foreground">
        <p className="text-[11px] uppercase tracking-[0.3em]">Templates</p>
        <p>Starting points ship next. Duplicate a rectangle to fake cards and text styles.</p>
      </div>
    </aside>
  );
}
