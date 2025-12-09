'use client';

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { CanvasElement, ElementKind } from "./types";

const DEFAULT_TEXT = {
  text: "Click to edit",
  fontSize: 32,
  fontFamily: "Inter, sans-serif",
  align: "left" as const,
  fill: "#111827",
};

const DEFAULT_RECT = {
  width: 240,
  height: 160,
  fill: "#2563eb",
  borderRadius: 12,
};

const DEFAULT_CIRCLE = {
  width: 200,
  height: 200,
  fill: "#f97316",
};

const DEFAULT_TRIANGLE = {
  width: 220,
  height: 190,
  fill: "#14b8a6",
};

const DEFAULT_PILL = {
  width: 260,
  height: 110,
  fill: "#a855f7",
  borderRadius: 55,
};

const DEFAULT_STAR = {
  width: 220,
  height: 220,
  fill: "#facc15",
};

const DEFAULT_DIAMOND = {
  width: 200,
  height: 240,
  fill: "#ef4444",
};

const DEFAULT_OCTAGON = {
  width: 240,
  height: 240,
  fill: "#22d3ee",
};

const DEFAULT_HALF_OCTAGON = {
  width: 240,
  height: 160,
  fill: "#f472b6",
};

const DEFAULT_IMAGE = {
  width: 300,
  height: 200,
  fit: "cover" as const,
};

function createElement(type: ElementKind): CanvasElement {
  const base = {
    id: nanoid(),
    type,
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    locked: false,
  } as CanvasElement;

  if (type === "text") {
    return { ...base, type: "text", ...DEFAULT_TEXT };
  }
  if (type === "image") {
    return { ...base, type: "image", src: "", ...DEFAULT_IMAGE } as CanvasElement;
  }
  if (type === "circle") {
    return { ...base, type: "circle", ...DEFAULT_CIRCLE } as CanvasElement;
  }
  if (type === "triangle") {
    return { ...base, type: "triangle", ...DEFAULT_TRIANGLE } as CanvasElement;
  }
  if (type === "pill") {
    return { ...base, type: "pill", ...DEFAULT_PILL } as CanvasElement;
  }
  if (type === "star") {
    return { ...base, type: "star", ...DEFAULT_STAR } as CanvasElement;
  }
  if (type === "diamond") {
    return { ...base, type: "diamond", ...DEFAULT_DIAMOND } as CanvasElement;
  }
  if (type === "octagon") {
    return { ...base, type: "octagon", ...DEFAULT_OCTAGON } as CanvasElement;
  }
  if (type === "half-octagon") {
    return { ...base, type: "half-octagon", ...DEFAULT_HALF_OCTAGON } as CanvasElement;
  }
  if (type === "line") {
    return { ...base, type: "line", ...DEFAULT_LINE } as CanvasElement;
  }
  if (type === "freehand") {
    return { ...base, type: "freehand", ...DEFAULT_FREEHAND } as CanvasElement;
  }
  return { ...base, type: "rect", ...DEFAULT_RECT } as CanvasElement;
}

function getDefaultSize(type: ElementKind) {
  if (type === "rect") {
    return { width: DEFAULT_RECT.width, height: DEFAULT_RECT.height };
  }
  if (type === "circle") {
    return { width: DEFAULT_CIRCLE.width, height: DEFAULT_CIRCLE.height };
  }
  if (type === "triangle") {
    return { width: DEFAULT_TRIANGLE.width, height: DEFAULT_TRIANGLE.height };
  }
  if (type === "pill") {
    return { width: DEFAULT_PILL.width, height: DEFAULT_PILL.height };
  }
  if (type === "star") {
    return { width: DEFAULT_STAR.width, height: DEFAULT_STAR.height };
  }
  if (type === "diamond") {
    return { width: DEFAULT_DIAMOND.width, height: DEFAULT_DIAMOND.height };
  }
  if (type === "octagon") {
    return { width: DEFAULT_OCTAGON.width, height: DEFAULT_OCTAGON.height };
  }
  if (type === "half-octagon") {
    return { width: DEFAULT_HALF_OCTAGON.width, height: DEFAULT_HALF_OCTAGON.height };
  }
  if (type === "line") {
    const xs = DEFAULT_LINE.points.filter((_, idx) => idx % 2 === 0);
    const ys = DEFAULT_LINE.points.filter((_, idx) => idx % 2 === 1);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    return { width: Math.max(width, 200), height: Math.max(height, 4) };
  }
  if (type === "freehand") {
    const xs = DEFAULT_FREEHAND.points.filter((_, idx) => idx % 2 === 0);
    const ys = DEFAULT_FREEHAND.points.filter((_, idx) => idx % 2 === 1);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    return { width: Math.max(width, 200), height: Math.max(height, 40) };
  }
  if (type === "image") {
    return { width: DEFAULT_IMAGE.width, height: DEFAULT_IMAGE.height };
  }
  return { width: 240, height: 60 };
}

export type CanvasStore = {
  elements: CanvasElement[];
  selectedId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  history: CanvasElement[][];
  future: CanvasElement[][];
  addElement: (type: ElementKind, overrides?: Partial<CanvasElement>) => CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  mutateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setBackgroundColor: (color: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  undo: () => void;
  redo: () => void;
  replaceElements: (elements: CanvasElement[]) => void;
  applyEdits: (edits: Array<{ id: string; updates: Partial<CanvasElement> }>) => void;
  reset: () => void;
};

const pushHistory = (state: CanvasStore): CanvasStore => {
  state.history.push(state.elements.map((el) => ({ ...el })));
  if (state.history.length > 50) {
    state.history.shift();
  }
  state.future = [];
  return state;
};

export const useCanvasStore = create<CanvasStore>((set) => ({
  elements: [],
  selectedId: null,
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundColor: "#f8fafc",
  history: [],
  future: [],
  addElement: (type, overrides) => {
    let created: CanvasElement | null = null;
    set((state) => {
      const base = createElement(type);
      const size = getDefaultSize(type);
      const centeredX = Math.max(40, state.canvasWidth / 2 - size.width / 2);
      const centeredY = Math.max(40, state.canvasHeight / 2 - size.height / 2);
      created = {
        ...base,
        x: centeredX,
        y: centeredY,
        ...overrides,
      } as CanvasElement;
      pushHistory(state);
      return { ...state, elements: [...state.elements, created], selectedId: created.id };
    });
    return created!;
  },
  updateElement: (id, updates) => {
    set((state) => {
      const index = state.elements.findIndex((el) => el.id === id);
      if (index === -1) return state;
      pushHistory(state);
      const next = [...state.elements];
      next[index] = { ...next[index], ...updates } as CanvasElement;
      return { ...state, elements: next };
    });
  },
  mutateElement: (id, updates) => {
    set((state) => {
      const index = state.elements.findIndex((el) => el.id === id);
      if (index === -1) return state;
      const next = [...state.elements];
      next[index] = { ...next[index], ...updates } as CanvasElement;
      return { ...state, elements: next };
    });
  },
  deleteElement: (id) => {
    set((state) => {
      pushHistory(state);
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    });
  },
  setSelectedId: (id) => set({ selectedId: id }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  bringForward: (id) => {
    set((state) => {
      const index = state.elements.findIndex((el) => el.id === id);
      if (index === -1 || index === state.elements.length - 1) return state;
      pushHistory(state);
      const next = [...state.elements];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item);
      return { ...state, elements: next };
    });
  },
  sendBackward: (id) => {
    set((state) => {
      const index = state.elements.findIndex((el) => el.id === id);
      if (index <= 0) return state;
      pushHistory(state);
      const next = [...state.elements];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return { ...state, elements: next };
    });
  },
  undo: () => {
    set((state) => {
      if (state.history.length === 0) return state;
      const previous = state.history.pop() ?? [];
      state.future.unshift(state.elements.map((el) => ({ ...el })));
      return { ...state, elements: previous, selectedId: null };
    });
  },
  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      const nextSnapshot = state.future.shift() ?? [];
      state.history.push(state.elements.map((el) => ({ ...el })));
      return { ...state, elements: nextSnapshot, selectedId: null };
    });
  },
  replaceElements: (elements) =>
    set((state) => {
      pushHistory(state);
      return { ...state, elements };
    }),
  applyEdits: (edits) => {
    if (!Array.isArray(edits) || edits.length === 0) {
      return;
    }
    set((state) => {
      const editMap = new Map<string, Partial<CanvasElement>>();
      for (const edit of edits) {
        if (!edit?.id || typeof edit.id !== "string" || !edit.updates) continue;
        editMap.set(edit.id, edit.updates);
      }
      if (editMap.size === 0) {
        return state;
      }
      let touched = false;
      const next = state.elements.map((element) => {
        const updates = editMap.get(element.id);
        if (!updates) return element;
        touched = true;
        return { ...element, ...updates } as CanvasElement;
      });
      if (!touched) {
        return state;
      }
      pushHistory(state);
      return { ...state, elements: next, selectedId: null };
    });
  },
  reset: () =>
    set({
      elements: [],
      selectedId: null,
      history: [],
      future: [],
    }),
}));
const DEFAULT_LINE = {
  width: 240,
  height: 6,
  points: [0, 0, 240, 0],
  stroke: "#111827",
  strokeWidth: 4,
};

const DEFAULT_FREEHAND = {
  width: 240,
  height: 80,
  points: [0, 50, 40, 10, 120, 70, 200, 20, 240, 60],
  stroke: "#111827",
  strokeWidth: 3,
};
