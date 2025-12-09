'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { AlignCenter, AlignLeft, AlignRight, Download, Italic, Save, Trash2, Bold, Rows3, Columns3, Sigma } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CellFormat = "text" | "number" | "currency" | "percent";
type CellAlign = "left" | "center" | "right";

type Cell = {
  value: string;
  bold: boolean;
  italic: boolean;
  textColor: string;
  backgroundColor: string;
  align: CellAlign;
  format: CellFormat;
};

type Spreadsheet = {
  id: string;
  title: string;
  description: string;
  cells: Record<string, Cell>;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
};

const MAX_SHEETS = 5;
const STORAGE_KEY = "ccpros-spreadsheets";
const DEFAULT_ROWS = 18;
const DEFAULT_COLUMNS = 9;
const MAX_ROWS = 200;
const MAX_COLUMNS = 50;

const BASE_CELL: Cell = {
  value: "",
  bold: false,
  italic: false,
  textColor: "#0f172a",
  backgroundColor: "#ffffff",
  align: "left",
  format: "text",
};

type Selection = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

const DEFAULT_SELECTION: Selection = {
  startRow: 0,
  endRow: 0,
  startCol: 0,
  endCol: 0,
};

function cellKey(row: number, col: number) {
  return `r${row}c${col}`;
}

function getColumnLabel(index: number) {
  let str = "";
  let num = index + 1;
  while (num > 0) {
    const rem = ((num - 1) % 26) + 65;
    str = String.fromCharCode(rem) + str;
    num = Math.floor((num - 1) / 26);
  }
  return str;
}

function generateLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function cleanCell(cell: Cell): Cell {
  return {
    value: cell.value ?? "",
    bold: Boolean(cell.bold),
    italic: Boolean(cell.italic),
    textColor: cell.textColor || BASE_CELL.textColor,
    backgroundColor: cell.backgroundColor || BASE_CELL.backgroundColor,
    align: cell.align || "left",
    format: cell.format || "text",
  };
}

function isPristine(cell: Cell) {
  return (
    cell.value === "" &&
    cell.bold === BASE_CELL.bold &&
    cell.italic === BASE_CELL.italic &&
    cell.textColor === BASE_CELL.textColor &&
    cell.backgroundColor === BASE_CELL.backgroundColor &&
    cell.align === BASE_CELL.align &&
    cell.format === BASE_CELL.format
  );
}

function hydrateCells(input: unknown): Record<string, Cell> {
  if (!input || typeof input !== "object") return {};
  const entries = Object.entries(input as Record<string, Cell>);
  return entries.reduce<Record<string, Cell>>((acc, [key, value]) => {
    if (!key.startsWith("r")) return acc;
    const merged = cleanCell({ ...BASE_CELL, ...(value ?? {}) });
    if (!isPristine(merged)) {
      acc[key] = merged;
    }
    return acc;
  }, {});
}

function clampGridValue(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(MAX_ROWS, Math.round(numeric)));
}

function clampColumnValue(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(MAX_COLUMNS, Math.round(numeric)));
}

function normalizeSheet(raw: Partial<Spreadsheet>): Spreadsheet {
  const now = new Date().toISOString();
  return {
    id: raw.id ?? generateLocalId(),
    title: raw.title?.toString() || "Untitled sheet",
    description: raw.description?.toString() ?? "",
    cells: hydrateCells(raw.cells),
    rowCount: clampGridValue(raw.rowCount ?? DEFAULT_ROWS, DEFAULT_ROWS),
    columnCount: clampColumnValue(raw.columnCount ?? DEFAULT_COLUMNS, DEFAULT_COLUMNS),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

export default function SpreadsheetPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [title, setTitle] = useState("Untitled sheet");
  const [description, setDescription] = useState("Finance tracker, KPI board, or sprint planning grid.");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS);
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMNS);
  const [selection, setSelection] = useState<Selection>({ ...DEFAULT_SELECTION });
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [savedSheets, setSavedSheets] = useState<Spreadsheet[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const anchorRef = useRef<{ row: number; col: number } | null>(null);

  const activeRange = useMemo(() => {
    const startRow = Math.max(0, Math.min(selection.startRow, selection.endRow));
    const endRow = Math.min(rowCount - 1, Math.max(selection.startRow, selection.endRow));
    const startCol = Math.max(0, Math.min(selection.startCol, selection.endCol));
    const endCol = Math.min(columnCount - 1, Math.max(selection.startCol, selection.endCol));
    return { startRow, endRow, startCol, endCol };
  }, [selection, rowCount, columnCount]);

  const selectedKeys = useMemo(() => {
    const keys: string[] = [];
    for (let row = activeRange.startRow; row <= activeRange.endRow; row += 1) {
      for (let col = activeRange.startCol; col <= activeRange.endCol; col += 1) {
        keys.push(cellKey(row, col));
      }
    }
    return keys;
  }, [activeRange]);

  const selectionStats = useMemo(() => {
    const values: number[] = [];
    selectedKeys.forEach((key) => {
      const cell = cells[key];
      if (!cell) return;
      const numeric = Number(cell.value);
      if (Number.isFinite(numeric)) {
        values.push(numeric);
      }
    });
    if (!values.length) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0 };
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    return {
      count: values.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
    };
  }, [cells, selectedKeys]);

  const isAtLimit = !activeSheetId && savedSheets.length >= MAX_SHEETS;

  const persistLocalSheets = useCallback((sheets: Spreadsheet[]) => {
    if (typeof window === "undefined") return;
    const trimmed = sheets.slice(0, MAX_SHEETS).map((sheet) => normalizeSheet(sheet));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    setSavedSheets(trimmed);
  }, []);

  const readLocalSheets = useCallback(() => {
    if (typeof window === "undefined") return [] as Spreadsheet[];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as Spreadsheet[];
      return parsed.slice(0, MAX_SHEETS).map((sheet) => normalizeSheet(sheet));
    } catch {
      return [];
    }
  }, []);

  const resetGrid = () => {
    setCells({});
    setRowCount(DEFAULT_ROWS);
    setColumnCount(DEFAULT_COLUMNS);
    setSelection({ ...DEFAULT_SELECTION });
  };

  const loadSheets = useCallback(async () => {
    if (!isSignedIn) {
      const local = readLocalSheets();
      setSavedSheets(local);
      return;
    }
    if (!isLoaded) return;
    setLoadingSheets(true);
    setSheetError(null);
    try {
      const response = await fetch("/api/spreadsheets");
      const body = (await response.json().catch(() => null)) as { sheets?: Spreadsheet[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to load spreadsheets");
      }
      const remoteSheets = (body?.sheets ?? []).map((sheet) => normalizeSheet(sheet));
      setSavedSheets(remoteSheets);
      persistLocalSheets(remoteSheets);
    } catch (error) {
      setSheetError((error as Error).message);
      const fallback = readLocalSheets();
      if (fallback.length) {
        setSavedSheets(fallback);
      }
    } finally {
      setLoadingSheets(false);
    }
  }, [isLoaded, isSignedIn, persistLocalSheets, readLocalSheets]);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  useEffect(() => {
    const handlePointerUp = () => setIsSelecting(false);
    window.addEventListener("mouseup", handlePointerUp);
    return () => window.removeEventListener("mouseup", handlePointerUp);
  }, []);

  useEffect(() => {
    setSelection((prev) => ({
      startRow: Math.min(prev.startRow, rowCount - 1),
      endRow: Math.min(prev.endRow, rowCount - 1),
      startCol: Math.min(prev.startCol, columnCount - 1),
      endCol: Math.min(prev.endCol, columnCount - 1),
    }));
  }, [rowCount, columnCount]);

  const mergeCell = (row: number, col: number, partial: Partial<Cell>) => {
    setCells((prev) => {
      const key = cellKey(row, col);
      const nextCell = cleanCell({ ...BASE_CELL, ...prev[key], ...partial });
      if (isPristine(nextCell)) {
        const trimmed = { ...prev };
        delete trimmed[key];
        return trimmed;
      }
      return { ...prev, [key]: nextCell };
    });
  };

  const handleValueChange = (row: number, col: number, value: string) => {
    mergeCell(row, col, { value });
    setSelection({ startRow: row, endRow: row, startCol: col, endCol: col });
  };

  const applyToSelection = (updater: (current: Cell) => Partial<Cell>) => {
    if (!selectedKeys.length) return;
    setCells((prev) => {
      const next = { ...prev };
      selectedKeys.forEach((key) => {
        const rowCol = key.match(/r(\d+)c(\d+)/);
        if (!rowCol) return;
        const merged = cleanCell({ ...BASE_CELL, ...next[key] });
        const updated = { ...merged, ...updater(merged) };
        if (isPristine(updated)) {
          delete next[key];
        } else {
          next[key] = updated;
        }
      });
      return next;
    });
  };

  const selectedCell = cells[cellKey(activeRange.startRow, activeRange.startCol)] ?? BASE_CELL;

  const handleSelectionStart = (row: number, col: number) => {
    anchorRef.current = { row, col };
    setSelection({ startRow: row, endRow: row, startCol: col, endCol: col });
    setIsSelecting(true);
  };

  const handleSelectionEnter = (row: number, col: number) => {
    if (!isSelecting || !anchorRef.current) return;
    setSelection((prev) => ({ ...prev, endRow: row, endCol: col }));
  };

  const getCellDisplayValue = (cell: Cell | undefined) => {
    if (!cell) return "";
    const trimmed = cell.value?.toString() ?? "";
    if (trimmed === "") return "";
    if (cell.format === "currency") {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
      }
    } else if (cell.format === "percent") {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return `${(numeric * 100).toFixed(1)}%`;
      }
    } else if (cell.format === "number") {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric);
      }
    }
    return trimmed;
  };

  const pruneCells = (rows: number, cols: number) => {
    setCells((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const match = key.match(/r(\d+)c(\d+)/);
        if (!match) return;
        const row = Number(match[1]);
        const col = Number(match[2]);
        if (row >= rows || col >= cols) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const addRow = () => setRowCount((prev) => Math.min(prev + 1, MAX_ROWS));
  const addColumn = () => setColumnCount((prev) => Math.min(prev + 1, MAX_COLUMNS));

  const removeRow = () =>
    setRowCount((prev) => {
      const next = Math.max(1, prev - 1);
      pruneCells(next, columnCount);
      return next;
    });
  const removeColumn = () =>
    setColumnCount((prev) => {
      const next = Math.max(1, prev - 1);
      pruneCells(rowCount, next);
      return next;
    });

  const buildMatrix = () => {
    const matrix: string[][] = [];
    for (let row = 0; row < rowCount; row += 1) {
      const rowValues: string[] = [];
      for (let col = 0; col < columnCount; col += 1) {
        rowValues.push(cells[cellKey(row, col)]?.value ?? "");
      }
      matrix.push(rowValues);
    }
    return matrix;
  };

  const downloadCsv = () => {
    const rows = buildMatrix();
    const csvLines = rows
      .map((row) =>
        row
          .map((value) => {
            const escaped = value.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "sheet"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadXlsx = async () => {
    const rows = buildMatrix();
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    XLSX.writeFile(workbook, `${title || "sheet"}.xlsx`);
  };

  const summarizeRange = useMemo(() => {
    if (!selectedKeys.length) return "Select cells to see stats";
    const { count, sum, avg } = selectionStats;
    if (!count) return `${selectedKeys.length} cells selected`;
    return `${count} numeric cells • Sum ${sum.toFixed(2)} • Avg ${avg.toFixed(2)}`;
  }, [selectionStats, selectedKeys.length]);

  const currentSheetPayload = (): Spreadsheet =>
    normalizeSheet({
      id: activeSheetId ?? generateLocalId(),
      title: title.trim() || "Untitled sheet",
      description: description.trim(),
      cells,
      rowCount,
      columnCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

  const handleSaveSheet = async () => {
    if (isAtLimit) {
      setSheetError(`Limit reached. Delete a spreadsheet before saving another (${MAX_SHEETS} max).`);
      return;
    }
    const payload = currentSheetPayload();
    if (!isSignedIn) {
      persistLocalSheets([payload, ...savedSheets.filter((sheet) => sheet.id !== payload.id)]);
      setActiveSheetId(payload.id);
      setSheetError(null);
      return;
    }
    setSavingSheet(true);
    setSheetError(null);
    try {
      const response = await fetch("/api/spreadsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSheetId ?? undefined,
          title: payload.title,
          description: payload.description,
          cells: payload.cells,
          rowCount: payload.rowCount,
          columnCount: payload.columnCount,
        }),
      });
      const body = (await response.json().catch(() => null)) as { sheet?: Spreadsheet; error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to save sheet");
      }
      const saved = body?.sheet ?? payload;
      persistLocalSheets([saved, ...savedSheets.filter((sheet) => sheet.id !== saved.id)]);
      setActiveSheetId(saved.id);
    } catch (error) {
      setSheetError((error as Error).message);
    } finally {
      setSavingSheet(false);
    }
  };

  const handleLoadSheet = (sheet: Spreadsheet) => {
    setTitle(sheet.title);
    setDescription(sheet.description);
    setCells(hydrateCells(sheet.cells));
    setRowCount(sheet.rowCount);
    setColumnCount(sheet.columnCount);
    setSelection({ ...DEFAULT_SELECTION });
    setActiveSheetId(sheet.id);
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (!isSignedIn) {
      persistLocalSheets(savedSheets.filter((sheet) => sheet.id !== sheetId));
      if (activeSheetId === sheetId) {
        setActiveSheetId(null);
        resetGrid();
      }
      return;
    }
    try {
      const response = await fetch("/api/spreadsheets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheetId }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to delete sheet");
      }
      persistLocalSheets(savedSheets.filter((sheet) => sheet.id !== sheetId));
      if (activeSheetId === sheetId) {
        setActiveSheetId(null);
        resetGrid();
      }
    } catch (error) {
      setSheetError((error as Error).message);
    }
  };

  const toolbarButtonClass = (enabled: boolean) =>
    cn(
      "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition",
      enabled ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 bg-background/70 text-muted-foreground"
    );

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Office & Productivity</p>
          <h1 className="text-3xl font-semibold">GridFlow Sheets</h1>
          <p className="text-sm text-muted-foreground">
            Build mini spreadsheets for finance, planning, or lightweight databases. Apply formatting, analyze selections, export to CSV or Excel,
            and store up to five sheets per account.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[18rem,1fr]">
          <aside className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-inner shadow-black/10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sheet details</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                placeholder="Sheet title"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 h-20 w-full rounded-2xl border border-border/60 bg-card/80 p-2 text-sm"
                placeholder="Describe intent or KPIs"
              />
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Grid size</p>
                  <p className="text-[11px] text-muted-foreground">Rows {rowCount} • Columns {columnCount}</p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={addRow} title="Add row" aria-label="Add row">
                    <Rows3 className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={addColumn} title="Add column" aria-label="Add column">
                    <Columns3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Button type="button" size="sm" variant="secondary" onClick={removeRow}>
                  Remove row
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={removeColumn}>
                  Remove column
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Exports</p>
                  <p className="text-[11px] text-muted-foreground">Download snapshots anytime.</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="flex-1 rounded-2xl" onClick={downloadCsv}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button type="button" variant="secondary" className="flex-1 rounded-2xl" onClick={downloadXlsx}>
                  <Download className="mr-2 h-4 w-4" /> XLSX
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" variant="default" className="rounded-2xl" onClick={handleSaveSheet} disabled={savingSheet}>
                  <Save className="mr-2 h-4 w-4" /> Save sheet
                </Button>
                {sheetError && <p className="text-xs text-destructive">{sheetError}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Saved sheets</p>
                  <p className="text-[11px] text-muted-foreground">Limit {MAX_SHEETS}</p>
                </div>
                {loadingSheets && <span className="text-xs text-muted-foreground">Loading…</span>}
              </div>
              <div className="mt-3 space-y-2">
                {savedSheets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No sheets saved yet.</p>
                ) : (
                  savedSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/80 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{sheet.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {sheet.rowCount}r × {sheet.columnCount}c • {new Date(sheet.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleLoadSheet(sheet)}>
                          Load
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteSheet(sheet.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-inner shadow-black/20">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" className={toolbarButtonClass(selectedCell.bold)} onClick={() => applyToSelection((cell) => ({ bold: !cell.bold }))}>
                  <Bold className="mr-1 h-3.5 w-3.5" /> Bold
                </button>
                <button type="button" className={toolbarButtonClass(selectedCell.italic)} onClick={() => applyToSelection((cell) => ({ italic: !cell.italic }))}>
                  <Italic className="mr-1 h-3.5 w-3.5" /> Italic
                </button>
                <button type="button" className={toolbarButtonClass(selectedCell.align === "left")} onClick={() => applyToSelection(() => ({ align: "left" }))}>
                  <AlignLeft className="mr-1 h-3.5 w-3.5" /> Left
                </button>
                <button type="button" className={toolbarButtonClass(selectedCell.align === "center")} onClick={() => applyToSelection(() => ({ align: "center" }))}>
                  <AlignCenter className="mr-1 h-3.5 w-3.5" /> Center
                </button>
                <button type="button" className={toolbarButtonClass(selectedCell.align === "right")} onClick={() => applyToSelection(() => ({ align: "right" }))}>
                  <AlignRight className="mr-1 h-3.5 w-3.5" /> Right
                </button>
                <select
                  className="rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs"
                  value={selectedCell.format}
                  onChange={(event) => applyToSelection(() => ({ format: event.target.value as CellFormat }))}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="currency">Currency</option>
                  <option value="percent">Percent</option>
                </select>
                <label className="flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs">
                  Text
                  <input
                    type="color"
                    value={selectedCell.textColor}
                    onChange={(event) => applyToSelection(() => ({ textColor: event.target.value }))}
                    className="h-5 w-10 border border-border/60 bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs">
                  Fill
                  <input
                    type="color"
                    value={selectedCell.backgroundColor}
                    onChange={(event) => applyToSelection(() => ({ backgroundColor: event.target.value }))}
                    className="h-5 w-10 border border-border/60 bg-transparent"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    applyToSelection(() => ({
                      bold: false,
                      italic: false,
                      backgroundColor: BASE_CELL.backgroundColor,
                      textColor: BASE_CELL.textColor,
                      align: "left",
                      format: "text",
                    }))
                  }
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear style
                </Button>
              </div>
              <div className="mt-3 rounded-2xl border border-border/70 bg-card/70 p-2 text-xs text-muted-foreground">{summarizeRange}</div>
            </div>

            <div className="mt-4 overflow-auto rounded-2xl border border-border/60 bg-background/80">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-10 w-12 bg-card/80 text-left text-xs font-semibold text-muted-foreground">&nbsp;</th>
                    {Array.from({ length: columnCount }).map((_, col) => (
                      <th key={`col-${col}`} className="min-w-[6rem] border-b border-border/60 bg-card/80 px-2 py-1 text-left text-xs font-semibold text-muted-foreground">
                        {getColumnLabel(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }).map((_, row) => (
                    <tr key={`row-${row}`}>
                      <th className="sticky left-0 z-10 w-12 border-b border-border/60 bg-card/80 px-2 text-left text-xs font-semibold text-muted-foreground">{row + 1}</th>
                      {Array.from({ length: columnCount }).map((__, col) => {
                        const key = cellKey(row, col);
                        const cell = cells[key];
                        const isSelected = row >= activeRange.startRow && row <= activeRange.endRow && col >= activeRange.startCol && col <= activeRange.endCol;
                        const displayValue = getCellDisplayValue(cell);
                        return (
                          <td
                            key={key}
                            className={cn(
                              "border-b border-l border-border/40 bg-white/80 p-0 text-xs",
                              isSelected ? "ring-2 ring-primary/70 ring-offset-1" : ""
                            )}
                            onMouseDown={() => handleSelectionStart(row, col)}
                            onMouseEnter={() => handleSelectionEnter(row, col)}
                          >
                            <input
                              value={cell?.value ?? ""}
                              onChange={(event) => handleValueChange(row, col, event.target.value)}
                              className="h-9 w-full border-none bg-transparent px-2 text-sm focus:outline-none"
                              style={{
                                textAlign: cell?.align ?? "left",
                                fontWeight: cell?.bold ? 700 : 400,
                                fontStyle: cell?.italic ? "italic" : "normal",
                                color: cell?.textColor ?? BASE_CELL.textColor,
                                backgroundColor: cell?.backgroundColor ?? BASE_CELL.backgroundColor,
                              }}
                              onFocus={() => setSelection({ startRow: row, endRow: row, startCol: col, endCol: col })}
                              title={displayValue}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Sigma className="h-4 w-4" /> Quick stats: {summarizeRange}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">Tip: drag across cells to highlight a range, then apply formatting or view instant metrics.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
