export type ElementKind =
  | "rect"
  | "text"
  | "image"
  | "circle"
  | "triangle"
  | "pill"
  | "star"
  | "diamond"
  | "octagon"
  | "half-octagon"
  | "line"
  | "freehand";

export type BaseElement = {
  id: string;
  type: ElementKind;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  locked: boolean;
};

export type ShapeElement = BaseElement & {
  type: "rect" | "circle" | "triangle" | "pill" | "star" | "diamond" | "octagon" | "half-octagon";
  width: number;
  height: number;
  fill: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
};

export type TextElement = BaseElement & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle?: string;
  align: "left" | "center" | "right";
  fill: string;
};

export type ImageElement = BaseElement & {
  type: "image";
  src: string;
  width: number;
  height: number;
  fit: "contain" | "cover" | "fill";
};

export type PathElement = BaseElement & {
  type: "line" | "freehand";
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type CanvasElement = ShapeElement | TextElement | ImageElement | PathElement;

export type LayoutPattern = "grid" | "hero" | "collage";

export type LayoutSuggestion = {
  pattern: LayoutPattern;
  description: string;
  steps: string[];
};
