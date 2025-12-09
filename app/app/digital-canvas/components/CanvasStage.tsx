'use client';

import { forwardRef, useCallback, useRef } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Image as KonvaImage,
  Circle as KonvaCircle,
  RegularPolygon,
  Line,
  Star,
} from "react-konva";
import type { Stage as StageType } from "konva/lib/Stage";
import type { KonvaEventObject } from "konva/lib/Node";
import useImage from "use-image";
import type { CanvasElement } from "../types";
import { useCanvasStore } from "../store";
import type { Vector2d } from "konva/lib/types";

function ImageNode({ element, onSelect }: { element: CanvasElement; onSelect: (id: string) => void }) {
  const [image] = useImage(element.type === "image" ? element.src : "");
  if (!image || element.type !== "image") return null;
  return (
    <KonvaImage
      image={image}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      opacity={element.opacity}
      rotation={element.rotation}
      draggable={!element.locked}
      onDragEnd={(event) =>
        useCanvasStore
          .getState()
          .updateElement(element.id, { x: event.target.x(), y: event.target.y() })
      }
      listening={!element.locked}
      onClick={() => onSelect(element.id)}
    />
  );
}

type CanvasStageProps = {
  activeTool: "default" | "line" | "freehand" | "eraser";
  strokeWidth: number;
  eraserWidth: number;
};

type Bounds = { x: number; y: number; width: number; height: number };

function getElementBounds(element: CanvasElement): Bounds | null {
  if (element.type === "text") {
    const width = Math.max(20, (element.text?.length ?? 1) * (element.fontSize ?? 16) * 0.6);
    const height = element.fontSize ?? 16;
    return { x: element.x, y: element.y, width, height };
  }
  if (
    element.type !== "line" &&
    element.type !== "freehand" &&
    "width" in element &&
    "height" in element
  ) {
    return { x: element.x, y: element.y, width: element.width ?? 0, height: element.height ?? 0 };
  }
  if (element.type === "line" || element.type === "freehand") {
    const points = element.points ?? [];
    if (points.length < 2) {
      return { x: element.x, y: element.y, width: element.strokeWidth ?? 4, height: element.strokeWidth ?? 4 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const px = points[i];
      const py = points[i + 1] ?? 0;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    return {
      x: element.x + minX,
      y: element.y + minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }
  return null;
}

export const CanvasStage = forwardRef<StageType, CanvasStageProps>(function CanvasStageInner(
  { activeTool, strokeWidth, eraserWidth },
  ref
) {
  const elements = useCanvasStore((state) => state.elements);
  const selectedId = useCanvasStore((state) => state.selectedId);
  const setSelectedId = useCanvasStore((state) => state.setSelectedId);
  const updateElement = useCanvasStore((state) => state.updateElement);
  const canvasWidth = useCanvasStore((state) => state.canvasWidth);
  const canvasHeight = useCanvasStore((state) => state.canvasHeight);
  const backgroundColor = useCanvasStore((state) => state.backgroundColor);
  const isTransparent = backgroundColor === "transparent";
  const drawingRef = useRef<{
    id: string;
    tool: "line" | "freehand";
    origin: { x: number; y: number };
  } | null>(null);
  const erasingRef = useRef(false);

  const eraseAt = useCallback(
    (pointer: Vector2d) => {
      const store = useCanvasStore.getState();
      const radius = eraserWidth / 2;
      const deletions: string[] = [];
      for (const element of store.elements) {
        const bounds = getElementBounds(element);
        if (!bounds) continue;
        if (
          pointer.x >= bounds.x - radius &&
          pointer.x <= bounds.x + bounds.width + radius &&
          pointer.y >= bounds.y - radius &&
          pointer.y <= bounds.y + bounds.height + radius
        ) {
          deletions.push(element.id);
        }
      }
      deletions.forEach((id) => store.deleteElement(id));
    },
    [eraserWidth]
  );

  const handleSelectElement = useCallback(
    (id: string) => {
      if (activeTool !== "default") {
        return;
      }
      setSelectedId(id);
    },
    [activeTool, setSelectedId]
  );

  const handlePointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = event.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      if (activeTool === "default") {
        if (event.target === stage) {
          setSelectedId(null);
        }
        return;
      }
      if (activeTool === "eraser") {
        erasingRef.current = true;
        eraseAt(pointer);
        return;
      }
      if (event.target !== stage) {
        return;
      }
      const store = useCanvasStore.getState();
      const element = store.addElement(activeTool, {
        x: pointer.x,
        y: pointer.y,
        width: 0,
        height: 0,
        points: [0, 0],
        strokeWidth,
      } as Partial<CanvasElement>);
      setSelectedId(element.id);
      drawingRef.current = {
        id: element.id,
        tool: activeTool,
        origin: { x: pointer.x, y: pointer.y },
      };
    },
    [activeTool, setSelectedId, strokeWidth, eraseAt]
  );

  const handlePointerMove = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = event.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      if (erasingRef.current && activeTool === "eraser") {
        eraseAt(pointer);
        return;
      }
      const drawing = drawingRef.current;
      if (!drawing) return;
      const store = useCanvasStore.getState();
      const offsetX = pointer.x - drawing.origin.x;
      const offsetY = pointer.y - drawing.origin.y;
      if (drawing.tool === "line") {
        store.mutateElement(drawing.id, { points: [0, 0, offsetX, offsetY] });
      } else {
        const element = store.elements.find((el) => el.id === drawing.id);
        if (element && (element.type === "line" || element.type === "freehand")) {
          const currentPoints = element.points ?? [0, 0];
          store.mutateElement(drawing.id, { points: [...currentPoints, offsetX, offsetY] });
        }
      }
    },
    [activeTool, eraseAt]
  );

  const endDrawing = useCallback(() => {
    drawingRef.current = null;
    erasingRef.current = false;
  }, []);
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950/60 p-6">
      <Stage
        width={canvasWidth}
        height={canvasHeight}
        ref={ref}
        className="rounded-2xl shadow-2xl"
        style={
          isTransparent
            ? {
                backgroundImage: "url('/images/checkerboard.svg')",
                backgroundSize: "32px 32px",
              }
            : undefined
        }
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={endDrawing}
      >
        <Layer listening>
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill={isTransparent ? undefined : backgroundColor}
            listening={false}
          />
          {elements.map((element) => {
            if (element.type === "rect" || element.type === "pill") {
              return (
                <Rect
                  key={element.id}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  cornerRadius={element.borderRadius ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, { x: event.target.x(), y: event.target.y() })
                  }
                />
              );
            }
            if (element.type === "circle") {
              const radius = Math.min(element.width, element.height) / 2;
              return (
                <KonvaCircle
                  key={element.id}
                  x={element.x + radius}
                  y={element.y + radius}
                  radius={radius}
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, {
                      x: event.target.x() - radius,
                      y: event.target.y() - radius,
                    })
                  }
                />
              );
            }
            if (element.type === "triangle") {
              const radius = Math.min(element.width, element.height) / 2;
              return (
                <RegularPolygon
                  key={element.id}
                  x={element.x + element.width / 2}
                  y={element.y + element.height / 2}
                  sides={3}
                  radius={radius}
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, {
                      x: event.target.x() - element.width / 2,
                      y: event.target.y() - element.height / 2,
                    })
                  }
                />
              );
            }
            if (element.type === "text") {
              return (
                <Text
                  key={element.id}
                  x={element.x}
                  y={element.y}
                  text={element.text}
                  fontSize={element.fontSize}
                  fontFamily={element.fontFamily}
                  fill={element.fill}
                  rotation={element.rotation}
                  opacity={element.opacity}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, { x: event.target.x(), y: event.target.y() })
                  }
                />
              );
            }
            if (element.type === "image") {
              return <ImageNode key={element.id} element={element} onSelect={handleSelectElement} />;
            }
            if (element.type === "star") {
              const radius = Math.min(element.width, element.height) / 2;
              return (
                <Star
                  key={element.id}
                  x={element.x + element.width / 2}
                  y={element.y + element.height / 2}
                  numPoints={5}
                  innerRadius={radius / 2.6}
                  outerRadius={radius}
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, {
                      x: event.target.x() - element.width / 2,
                      y: event.target.y() - element.height / 2,
                    })
                  }
                />
              );
            }
            if (element.type === "diamond") {
              const halfWidth = element.width / 2;
              const halfHeight = element.height / 2;
              const points = [0, -halfHeight, halfWidth, 0, 0, halfHeight, -halfWidth, 0];
              return (
                <Line
                  key={element.id}
                  x={element.x + halfWidth}
                  y={element.y + halfHeight}
                  points={points}
                  closed
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, {
                      x: event.target.x() - halfWidth,
                      y: event.target.y() - halfHeight,
                    })
                  }
                />
              );
            }
            if (element.type === "octagon") {
              const radius = Math.min(element.width, element.height) / 2;
              return (
                <RegularPolygon
                  key={element.id}
                  x={element.x + element.width / 2}
                  y={element.y + element.height / 2}
                  sides={8}
                  radius={radius}
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, {
                      x: event.target.x() - element.width / 2,
                      y: event.target.y() - element.height / 2,
                    })
                  }
                />
              );
            }
            if (element.type === "half-octagon") {
              const width = element.width;
              const height = element.height;
              const inset = Math.min(width, height) * 0.2;
              const points = [
                0,
                height,
                width,
                height,
                width,
                height / 2 + inset,
                width - inset,
                inset,
                inset,
                inset,
                0,
                height / 2 + inset,
              ];
              return (
                <Line
                  key={element.id}
                  x={element.x}
                  y={element.y}
                  points={points}
                  closed
                  fill={element.fill}
                  opacity={element.opacity}
                  rotation={element.rotation}
                  stroke={selectedId === element.id ? "#0ea5e9" : element.borderColor}
                  strokeWidth={selectedId === element.id ? 2 : element.borderWidth ?? 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, { x: event.target.x(), y: event.target.y() })
                  }
                />
              );
            }
            if (element.type === "line" || element.type === "freehand") {
              return (
                <Line
                  key={element.id}
                  x={element.x}
                  y={element.y}
                  points={element.points ?? []}
                  stroke={element.stroke ?? "#111827"}
                  strokeWidth={element.strokeWidth ?? 4}
                  opacity={element.opacity}
                  lineCap="round"
                  lineJoin="round"
                  tension={element.type === "freehand" ? 0.5 : 0}
                  draggable={!element.locked}
                  onClick={() => handleSelectElement(element.id)}
                  onDragEnd={(event) =>
                    updateElement(element.id, { x: event.target.x(), y: event.target.y() })
                  }
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
});
