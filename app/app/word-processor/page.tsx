'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Save,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Type,
  Underline,
  Undo2,
  Eraser,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import {
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STARTER_DOCUMENT = `<h2>Project summary</h2><p>Capture project context, goals, and the latest updates. Use the toolbar above the editor to create hierarchy, structure, and emphasis. Export to PDF, DOCX, or TXT whenever you are ready to share.</p><ul><li>Goals</li><li>Updates</li><li>Next steps</li></ul>`;

type FontOption = {
  label: string;
  value: string;
  stack: string;
};

const FONT_OPTIONS: FontOption[] = [
  { label: "Inter", value: "Inter", stack: "Inter, sans-serif" },
  { label: "Space Grotesk", value: "Space Grotesk", stack: "'Space Grotesk', sans-serif" },
  { label: "Playfair Display", value: "Playfair Display", stack: "'Playfair Display', serif" },
  { label: "Source Serif 4", value: "Source Serif 4", stack: "'Source Serif 4', serif" },
  { label: "Space Mono", value: "Space Mono", stack: "'Space Mono', monospace" },
  { label: "Nunito", value: "Nunito", stack: "Nunito, sans-serif" },
  { label: "Work Sans", value: "Work Sans", stack: "'Work Sans', sans-serif" },
  { label: "Lora", value: "Lora", stack: "Lora, serif" },
  { label: "Crimson Pro", value: "Crimson Pro", stack: "'Crimson Pro', serif" },
  { label: "Times New Roman", value: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  { label: "Arial", value: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri", stack: "Calibri, 'Segoe UI', sans-serif" },
  { label: "Cambria", value: "Cambria", stack: "Cambria, Georgia, serif" },
  { label: "Georgia", value: "Georgia", stack: "Georgia, serif" },
  { label: "Verdana", value: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS", stack: "'Trebuchet MS', 'Segoe UI', sans-serif" },
];

const MAX_SAVED_DOCS = 5;
const LOCAL_STORAGE_KEY = "ccpros-word-docs";

type PageBorderStyle = "none" | "single" | "single-bold" | "dotted" | "dashed" | "double";

type BorderStyleOption = {
  label: string;
  width: number;
  cssStyle: CSSProperties["borderStyle"];
  color: string;
};

const BORDER_STYLE_OPTIONS: Record<PageBorderStyle, BorderStyleOption> = {
  none: { label: "None", width: 0, cssStyle: "solid", color: "var(--color-border)" },
  single: { label: "Single (light)", width: 2, cssStyle: "solid", color: "var(--color-primary)" },
  "single-bold": { label: "Single (bold)", width: 4, cssStyle: "solid", color: "var(--color-primary)" },
  dotted: { label: "Dotted", width: 3, cssStyle: "dotted", color: "var(--color-primary)" },
  dashed: { label: "Dashed", width: 3, cssStyle: "dashed", color: "var(--color-primary)" },
  double: { label: "Double accent", width: 6, cssStyle: "double", color: "var(--color-primary)" },
};

type Margins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type BorderSides = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

const DEFAULT_BORDER_SIDES: BorderSides = {
  top: true,
  right: true,
  bottom: true,
  left: true,
};
type BorderSideKey = keyof BorderSides;

const DEFAULT_MARGINS_INCHES: Margins = { top: 1, right: 1, bottom: 1, left: 1 };
const DEFAULT_MARGINS: Margins = { ...DEFAULT_MARGINS_INCHES };
const MIN_MARGIN_IN = 0;
const MAX_MARGIN_IN = 3;
const PAGE_WIDTH_IN = 9.5;
const PAGE_HEIGHT_IN = 11;
const DPI = 96;
const PAGE_WIDTH_PX = Math.round(PAGE_WIDTH_IN * DPI);
const PAGE_HEIGHT_PX = Math.round(PAGE_HEIGHT_IN * DPI);

type SavedDocument = {
  id: string;
  title: string;
  author: string;
  content: string;
  fontValue: string;
  pageBorderStyle: PageBorderStyle;
  borderSides: BorderSides;
  lineNumbering: boolean;
  margins: Margins;
  showRulers: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function WordProcessorPage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const [title, setTitle] = useState("Untitled document");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState(STARTER_DOCUMENT);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0]);
  const [exporting, setExporting] = useState<null | "pdf" | "docx" | "txt">(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
  const [pageBorderStyle, setPageBorderStyle] = useState<PageBorderStyle>("none");
  const [lineNumbering, setLineNumbering] = useState(false);
  const [borderSides, setBorderSides] = useState<BorderSides>({ ...DEFAULT_BORDER_SIDES });
  const [margins, setMargins] = useState<Margins>({ ...DEFAULT_MARGINS_INCHES });
  const [showRulers, setShowRulers] = useState(true);
  const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const { isLoaded, isSignedIn } = useUser();
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [aiMode, setAiMode] = useState<null | "grammar" | "rewrite">(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = STARTER_DOCUMENT;
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }
    setDocumentsLoading(true);
    setDocError(null);
    try {
      const response = await fetch("/api/word-documents");
      const body = (await response.json().catch(() => null)) as
        | { documents?: SavedDocument[]; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to load saved documents");
      }
      const remoteDocs = body?.documents ?? [];
      setSavedDocs(remoteDocs);
      persistLocalDocuments(remoteDocs);
    } catch (error) {
      setDocError((error as Error).message);
      const fallback = readLocalDocuments();
      if (fallback.length > 0) {
        setSavedDocs(fallback);
      }
    } finally {
      setDocumentsLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      const localDocs = readLocalDocuments();
      setSavedDocs(localDocs);
       setDocError(null);
      return;
    }
    loadDocuments();
  }, [isLoaded, isSignedIn, loadDocuments]);

  useEffect(() => {
    if (savedDocs.length === 0) {
      if (activeDocId !== null) {
        setActiveDocId(null);
      }
      return;
    }
    if (activeDocId && savedDocs.some((doc) => doc.id === activeDocId)) {
      return;
    }
    setActiveDocId(savedDocs[0].id);
  }, [savedDocs, activeDocId]);

  const plainText = useMemo(() => htmlToPlainText(content), [content]);
  const wordCount = useMemo(() => (plainText ? plainText.trim().split(/\s+/).filter(Boolean).length : 0), [plainText]);
  const characterCount = useMemo(() => (plainText ? plainText.replace(/\s+/g, "").length : 0), [plainText]);
  const paragraphCount = useMemo(() => (plainText ? plainText.split(/\n+/).filter(Boolean).length : 0), [plainText]);
  const showPlaceholder = plainText.length === 0;
  const lineCount = useMemo(() => estimateLineCount(content), [content]);
  const lineNumbers = useMemo(
    () => Array.from({ length: Math.min(lineCount, 999) }, (_, index) => index + 1),
    [lineCount]
  );
  const hasAnyBorderSide = useMemo(() => Object.values(borderSides).some(Boolean), [borderSides]);
  const disableBorderSides = pageBorderStyle === "none";
  const hasCustomBorder = pageBorderStyle !== "none" && hasAnyBorderSide;
  const borderStyleProps = useMemo(() => {
    const option = BORDER_STYLE_OPTIONS[pageBorderStyle];
    const style: CSSProperties = {
      borderTopWidth: borderSides.top ? option.width : 0,
      borderRightWidth: borderSides.right ? option.width : 0,
      borderBottomWidth: borderSides.bottom ? option.width : 0,
      borderLeftWidth: borderSides.left ? option.width : 0,
      borderTopStyle: borderSides.top ? (option.cssStyle as CSSProperties["borderTopStyle"]) : "none",
      borderRightStyle: borderSides.right ? (option.cssStyle as CSSProperties["borderRightStyle"]) : "none",
      borderBottomStyle: borderSides.bottom ? (option.cssStyle as CSSProperties["borderBottomStyle"]) : "none",
      borderLeftStyle: borderSides.left ? (option.cssStyle as CSSProperties["borderLeftStyle"]) : "none",
      borderColor: option.color,
    };
    return style;
  }, [pageBorderStyle, borderSides]);
  const marginPaddingStyle = useMemo(
    () => ({
      paddingTop: `${inchesToPixels(margins.top)}px`,
      paddingRight: `${inchesToPixels(margins.right)}px`,
      paddingBottom: `${inchesToPixels(margins.bottom)}px`,
      paddingLeft: `${inchesToPixels(margins.left)}px`,
    }),
    [margins]
  );
  const marginVerticalStyle = useMemo(
    () => ({
      paddingTop: `${inchesToPixels(margins.top)}px`,
      paddingBottom: `${inchesToPixels(margins.bottom)}px`,
    }),
    [margins]
  );
  const atSaveLimit = !activeDocId && savedDocs.length >= MAX_SAVED_DOCS;
  const saveButtonLabel = isSignedIn
    ? activeDocId
      ? "Update document"
      : "Save document"
    : activeDocId
      ? "Update local"
      : "Save local";
  const saveButtonText = savingDoc ? "Saving..." : saveButtonLabel;
  const disableSaveButton = savingDoc || (isSignedIn && atSaveLimit);

  const syncEditorState = () => {
    setContent(editorRef.current?.innerHTML ?? "");
  };

  const scheduleStateSync = () => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(syncEditorState);
    } else {
      setTimeout(syncEditorState, 0);
    }
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const applyCommand = (command: string, value?: string) => {
    if (typeof window === "undefined" || !editorRef.current) {
      return;
    }
    focusEditor();
    document.execCommand(command, false, value ?? "");
    scheduleStateSync();
  };

  const handleFontChange = (value: string) => {
    const option = FONT_OPTIONS.find((font) => font.value === value);
    if (!option) return;
    setFontFamily(option);
    applyCommand("fontName", option.value);
  };

  const sanitizeFileName = (input: string, extension: string) => {
    const base = input.trim().replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, "-") || "document";
    return `${base.toLowerCase()}.${extension}`;
  };

  const hydrateEditorContent = (html: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
    }
    setContent(html);
  };

  const handleSaveDocument = async () => {
    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    const currentContent = editorRef.current?.innerHTML ?? content;
    const docId = activeDocId ?? crypto.randomUUID();
    const existingDoc = savedDocs.find((doc) => doc.id === docId);
    const now = new Date().toISOString();
    const normalizedMargins = normalizeMarginsInput(margins);
    const normalizedSides = normalizeBorderSidesInput(borderSides);
    const docPayload: SavedDocument = {
      id: docId,
      title: trimmedTitle || "Untitled document",
      author: trimmedAuthor,
      content: currentContent,
      fontValue: fontFamily.value,
      pageBorderStyle,
      borderSides: normalizedSides,
      lineNumbering,
      margins: normalizedMargins,
      showRulers: Boolean(showRulers),
      createdAt: existingDoc?.createdAt ?? now,
      updatedAt: now,
    };

    if (!isSignedIn) {
      if (!activeDocId && savedDocs.length >= MAX_SAVED_DOCS) {
        setDocError(`Limit reached. Delete a document to save another (max ${MAX_SAVED_DOCS}).`);
        return;
      }
      const nextDocs = [docPayload, ...savedDocs.filter((doc) => doc.id !== docId)].slice(0, MAX_SAVED_DOCS);
      setSavedDocs(nextDocs);
      persistLocalDocuments(nextDocs);
      setActiveDocId(docId);
      setDocError(null);
      return;
    }

    if (atSaveLimit) {
      setDocError(`Limit reached. Delete a document to save another (max ${MAX_SAVED_DOCS}).`);
      return;
    }

    setSavingDoc(true);
    setDocError(null);
    try {
      const response = await fetch("/api/word-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeDocId ?? undefined,
          title: docPayload.title,
          author: docPayload.author,
          content: docPayload.content,
          fontValue: docPayload.fontValue,
          pageBorderStyle: docPayload.pageBorderStyle,
          borderSides: docPayload.borderSides,
          lineNumbering: docPayload.lineNumbering,
          margins: docPayload.margins,
          showRulers: docPayload.showRulers,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { document?: SavedDocument; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to save document");
      }
      const saved = body?.document;
      if (saved) {
        setSavedDocs((prev) => {
          const filtered = prev.filter((doc) => doc.id !== saved.id);
          const next = [saved, ...filtered].slice(0, MAX_SAVED_DOCS);
          persistLocalDocuments(next);
          return next;
        });
        setActiveDocId(saved.id);
      }
    } catch (error) {
      setDocError((error as Error).message);
    } finally {
      setSavingDoc(false);
    }
  };

  const handleLoadDocument = (docId: string) => {
    const doc = savedDocs.find((item) => item.id === docId);
    if (!doc) return;
    setDocError(null);
    setActiveDocId(doc.id);
    setTitle(doc.title || "Untitled document");
    setAuthor(doc.author || "");
    const font = FONT_OPTIONS.find((option) => option.value === doc.fontValue) ?? FONT_OPTIONS[0];
    setFontFamily(font);
    setPageBorderStyle(doc.pageBorderStyle ?? "none");
    setBorderSides(normalizeBorderSidesInput(doc.borderSides));
    setLineNumbering(Boolean(doc.lineNumbering));
    setMargins(normalizeMarginsInput(doc.margins));
    setShowRulers(doc.showRulers ?? true);
    hydrateEditorContent(doc.content || "");
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!isSignedIn) {
      const next = savedDocs.filter((doc) => doc.id !== docId);
      setSavedDocs(next);
      persistLocalDocuments(next);
      if (activeDocId === docId) {
        setActiveDocId(null);
      }
      return;
    }
    try {
      const response = await fetch("/api/word-documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to delete document");
      }
      setSavedDocs((prev) => {
        const next = prev.filter((doc) => doc.id !== docId);
        persistLocalDocuments(next);
        return next;
      });
      if (activeDocId === docId) {
        setActiveDocId(null);
      }
    } catch (error) {
      setDocError((error as Error).message);
    }
  };

  const handleMarginChange = (side: keyof Margins, rawValue: string) => {
    const numeric = Number(rawValue);
    const fallbackValue = DEFAULT_MARGINS[side];
    const next = sanitizeMarginInput(Number.isFinite(numeric) ? numeric : fallbackValue, fallbackValue);
    setMargins((prev) => ({ ...prev, [side]: next }));
  };

  const captureSelectionText = () => {
    if (typeof window === "undefined" || !editorRef.current) {
      return "";
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return "";
    }
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return "";
    }
    const text = selection.toString().trim();
    if (!text) {
      return "";
    }
    selectionRangeRef.current = range.cloneRange();
    return text;
  };

  const runAiAssistant = async (mode: "grammar" | "rewrite") => {
    const selectionText = captureSelectionText();
    if (!selectionText) {
      setAiErrorMessage("Highlight some text inside the editor before requesting AI help.");
      return;
    }
    setAiLoading(true);
    setAiMode(mode);
    setAiErrorMessage(null);
    try {
      const response = await fetch("/api/word-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text: selectionText,
          context: `Document title: ${title}.`,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI request failed");
      }
      const replacement = (data.replacement as string | undefined)?.trim() ?? "";
      const notes = Array.isArray(data.notes) ? (data.notes as string[]) : [];
      if (!replacement) {
        setAiErrorMessage("AI did not return any text to use.");
        setAiSuggestion("");
        setAiNotes([]);
      } else {
        setAiSuggestion(replacement);
        setAiNotes(notes);
      }
    } catch (error) {
      setAiErrorMessage((error as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion || !selectionRangeRef.current || !editorRef.current) {
      return;
    }
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    selection.removeAllRanges();
    selection.addRange(selectionRangeRef.current);
    document.execCommand("insertText", false, aiSuggestion);
    selection.removeAllRanges();
    selectionRangeRef.current = null;
    setAiSuggestion("");
    setAiNotes([]);
    setAiMode(null);
    focusEditor();
    scheduleStateSync();
  };

  const copyAiSuggestion = async () => {
    if (!aiSuggestion) return;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard not available");
      }
      await navigator.clipboard.writeText(aiSuggestion);
    } catch (error) {
      setAiErrorMessage((error as Error).message || "Unable to copy text to clipboard.");
    }
  };

  const handleDownloadTxt = () => {
    if (!editorRef.current) return;
    setExporting("txt");
    try {
      const text = buildDocumentText(title, author, plainText);
      const blob = new Blob([text], { type: "text/plain" });
      triggerDownload(blob, sanitizeFileName(title, "txt"));
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadPdf = () => {
    if (!editorRef.current) return;
    setExporting("pdf");
    try {
      const text = buildDocumentText(title, author, plainText);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 56;
      const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.text(lines, margin, margin);
      doc.save(sanitizeFileName(title, "pdf"));
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadDocx = async () => {
    if (!editorRef.current) return;
    setExporting("docx");
    try {
      const paragraphs = plainText.split(/\n+/).filter(Boolean);
      const doc = new DocxDocument({
        creator: author || undefined,
        title: title || "Untitled document",
        description: "Generated with the CCPROS word processor",
        sections: [
          {
            children: [
              new Paragraph({
                text: title || "Untitled document",
                heading: HeadingLevel.HEADING_1,
              }),
              ...(author
                ? [
                    new Paragraph({
                      children: [new TextRun({ text: `Author: ${author}` })],
                      spacing: { after: 200 },
                    }),
                  ]
                : []),
              ...paragraphs.map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun({ text: line })],
                    spacing: { after: 200 },
                  })
              ),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      triggerDownload(blob, sanitizeFileName(title, "docx"));
    } finally {
      setExporting(null);
    }
  };

  const editorPlaceholder =
    "Write your doc here. Use the toolbar to format headings, structure updates, and prep exports.";

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Office & Productivity</p>
          <h1 className="text-3xl font-semibold">Word Processor</h1>
          <p className="text-sm text-muted-foreground">
            Draft docs, take meeting notes, or assemble briefs directly inside the dashboard and export them in the format your
            team expects.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[18rem,1fr]">
          <aside className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-inner shadow-black/10">
            <section className="rounded-2xl border border-border/60 bg-card/70">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground"
                aria-expanded={!controlsCollapsed}
                onClick={() => setControlsCollapsed((prev) => !prev)}
              >
                Document console
                <ChevronDown
                  className={cn("size-4 transition-transform", !controlsCollapsed && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
              <div className={cn("space-y-5 border-t border-border/60 px-4 py-4", controlsCollapsed && "hidden")}>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Document meta</p>
                  <label className="block text-xs text-muted-foreground">
                    Title
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                      placeholder="Untitled document"
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Author
                    <input
                      value={author}
                      onChange={(event) => setAuthor(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Base font</p>
                  <select
                    className="mt-2 w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                    value={fontFamily.value}
                    onChange={(event) => handleFontChange(event.target.value)}
                  >
                    {FONT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Page border</p>
                  <select
                    className="w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                    value={pageBorderStyle}
                    onChange={(event) => setPageBorderStyle(event.target.value as PageBorderStyle)}
                  >
                    {Object.entries(BORDER_STYLE_OPTIONS).map(([value, option]) => (
                      <option key={value} value={value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Apply borders to specific edges to mirror document formatting requirements.
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Border sides</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(Object.keys(DEFAULT_BORDER_SIDES) as BorderSideKey[]).map((side) => (
                      <label
                        key={side}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border border-border/50 bg-card/70 px-3 py-2 text-xs capitalize text-muted-foreground",
                          disableBorderSides && "opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={borderSides[side]}
                          disabled={disableBorderSides}
                          onChange={(event) =>
                            setBorderSides((prev) => ({ ...prev, [side]: event.target.checked }))
                          }
                          className="size-4 rounded border border-border/60"
                        />
                        {side}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Margins (inches)</p>
                  <p className="text-[11px] text-muted-foreground">Paper size fixed at 9.5in × 11in.</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {(Object.keys(DEFAULT_MARGINS) as Array<keyof Margins>).map((side) => (
                      <label key={side} className="text-xs text-muted-foreground">
                        {side.charAt(0).toUpperCase() + side.slice(1)}
                        <input
                          type="number"
                          min={MIN_MARGIN_IN}
                          max={MAX_MARGIN_IN}
                          step={0.25}
                          value={margins[side]}
                          onChange={(event) => handleMarginChange(side, event.target.value)}
                          className="mt-1 w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={lineNumbering}
                    onChange={(event) => setLineNumbering(event.target.checked)}
                    className="size-4 rounded border border-border/60"
                  />
                  Enable line numbering
                </label>
                <label className="flex items-center gap-3 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showRulers}
                    onChange={(event) => setShowRulers(event.target.checked)}
                    className="size-4 rounded border border-border/60"
                  />
                  Show ruler guides
                </label>

                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Exports</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadPdf}
                      disabled={exporting !== null}
                      className="flex-1 rounded-2xl"
                    >
                      <Download className="size-4" />
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadDocx}
                      disabled={exporting !== null}
                      className="flex-1 rounded-2xl"
                    >
                      <Download className="size-4" />
                      DOCX
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDownloadTxt}
                      disabled={exporting !== null}
                      className="flex-1 rounded-2xl"
                    >
                      <Download className="size-4" />
                      TXT
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Stats</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Words</dt>
                      <dd className="font-semibold">{wordCount}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Characters</dt>
                      <dd className="font-semibold">{characterCount}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Paragraphs</dt>
                      <dd className="font-semibold">{paragraphCount}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Document files</p>
                      <p className="text-[11px] text-muted-foreground">
                        {isSignedIn
                          ? `Store up to ${MAX_SAVED_DOCS} drafts in your account.`
                          : "Drafts save locally in this browser. Sign in to sync across devices."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-xl"
                      onClick={handleSaveDocument}
                      disabled={disableSaveButton}
                    >
                      <Save className="size-4" />
                      {saveButtonText}
                    </Button>
                  </div>
                  {atSaveLimit && isSignedIn && (
                    <p className="mt-2 text-xs text-destructive">
                      Delete a saved document before storing another.
                    </p>
                  )}
                  {docError && <p className="mt-2 text-xs text-destructive">{docError}</p>}
                  <div className="mt-4 space-y-3">
                    {documentsLoading ? (
                      <p className="text-xs text-muted-foreground">Loading your documents…</p>
                    ) : savedDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No saved drafts yet.</p>
                    ) : (
                      savedDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/80 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{doc.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Updated {formatTimestamp(doc.updatedAt)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleLoadDocument(doc.id)}
                            >
                              Load
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteDocument(doc.id)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI assistant</p>
                      <p className="text-[11px] text-muted-foreground">
                        Highlight text inside the editor to run grammar fixes or rewrite ideas.
                      </p>
                    </div>
                    {aiLoading && <span className="text-xs text-muted-foreground">Thinking…</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-xl"
                      disabled={aiLoading}
                      onClick={() => runAiAssistant("grammar")}
                    >
                      Grammar & spelling
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-xl"
                      disabled={aiLoading}
                      onClick={() => runAiAssistant("rewrite")}
                    >
                      Rewrite ideas
                    </Button>
                  </div>
                  {aiErrorMessage && <p className="mt-2 text-xs text-destructive">{aiErrorMessage}</p>}
                  {aiSuggestion && (
                    <div className="mt-4 space-y-2">
                      {aiMode && (
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          {aiMode === "grammar" ? "Grammar check" : "Rewrite suggestions"}
                        </p>
                      )}
                      <textarea
                        readOnly
                        value={aiSuggestion}
                        className="h-32 w-full rounded-2xl border border-border/50 bg-card/80 p-3 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={applyAiSuggestion}
                          disabled={!selectionRangeRef.current || aiSuggestion.length === 0}
                        >
                          Replace selection
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={copyAiSuggestion}>
                          Copy text
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAiSuggestion("");
                            setAiNotes([]);
                            setAiErrorMessage(null);
                            setAiMode(null);
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                      {aiNotes.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {aiNotes.map((note, index) => (
                            <li key={`${note}-${index}`}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </aside>

          <div className="flex min-h-[580px] flex-col rounded-3xl border border-border/60 bg-card/80 shadow-inner shadow-black/20">
            <WordProcessorToolbar
              onBold={() => applyCommand("bold")}
              onItalic={() => applyCommand("italic")}
              onUnderline={() => applyCommand("underline")}
              onHeading={() => applyCommand("formatBlock", "H2")}
              onBullets={() => applyCommand("insertUnorderedList")}
              onNumbered={() => applyCommand("insertOrderedList")}
              onAlignLeft={() => applyCommand("justifyLeft")}
              onAlignCenter={() => applyCommand("justifyCenter")}
              onAlignRight={() => applyCommand("justifyRight")}
              onQuote={() => applyCommand("formatBlock", "blockquote")}
              onUndo={() => applyCommand("undo")}
              onRedo={() => applyCommand("redo")}
              onClear={() => applyCommand("removeFormat")}
            />
            <div className="flex-1 overflow-hidden p-6">
              <div className="flex h-full w-full gap-6 overflow-auto px-6 py-5">
                {lineNumbering && (
                  <div className="flex shrink-0 select-none flex-col text-right font-mono text-[11px] leading-relaxed text-muted-foreground/80">
                    {showRulers && <div className="mb-2 h-8" />}
                    <div className="w-10" style={marginVerticalStyle}>
                      {lineNumbers.map((number) => (
                        <div key={number} className="leading-relaxed">
                          {number}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "relative flex h-full min-h-[480px] flex-1 flex-col bg-background/90",
                    !hasCustomBorder && "border border-border/50"
                  )}
                  style={{
                    width: `${PAGE_WIDTH_PX}px`,
                    minHeight: `${PAGE_HEIGHT_PX}px`,
                    ...(hasCustomBorder ? borderStyleProps : {}),
                  }}
                >
                  {showRulers && <HorizontalRuler widthInches={PAGE_WIDTH_IN} />}
                  <div className="flex-1 overflow-auto">
                    <div style={marginPaddingStyle} className="min-h-full w-full">
                      <div
                        ref={editorRef}
                        className={cn(
                          "relative min-h-full w-full text-base leading-relaxed outline-none focus:ring-2 focus:ring-primary/30",
                          showPlaceholder &&
                            "before:pointer-events-none before:absolute before:left-0 before:top-0 before:text-sm before:text-muted-foreground/70 before:content-[attr(data-placeholder)]"
                        )}
                        style={{ fontFamily: fontFamily.stack }}
                        contentEditable
                        spellCheck
                        data-placeholder={editorPlaceholder}
                        onInput={syncEditorState}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type ToolbarProps = {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onHeading: () => void;
  onBullets: () => void;
  onNumbered: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onQuote: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
};

function WordProcessorToolbar({
  onBold,
  onItalic,
  onUnderline,
  onHeading,
  onBullets,
  onNumbered,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onQuote,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
      <ToolbarButton icon={Undo2} label="Undo" onAction={onUndo} />
      <ToolbarButton icon={Redo2} label="Redo" onAction={onRedo} />
      <span className="mx-2 h-6 w-px bg-border/70" aria-hidden="true" />
      <ToolbarButton icon={Bold} label="Bold" onAction={onBold} />
      <ToolbarButton icon={Italic} label="Italic" onAction={onItalic} />
      <ToolbarButton icon={Underline} label="Underline" onAction={onUnderline} />
      <ToolbarButton icon={Type} label="Heading" onAction={onHeading} />
      <span className="mx-2 h-6 w-px bg-border/70" aria-hidden="true" />
      <ToolbarButton icon={AlignLeft} label="Align left" onAction={onAlignLeft} />
      <ToolbarButton icon={AlignCenter} label="Align center" onAction={onAlignCenter} />
      <ToolbarButton icon={AlignRight} label="Align right" onAction={onAlignRight} />
      <span className="mx-2 h-6 w-px bg-border/70" aria-hidden="true" />
      <ToolbarButton icon={List} label="Bulleted list" onAction={onBullets} />
      <ToolbarButton icon={ListOrdered} label="Numbered list" onAction={onNumbered} />
      <ToolbarButton icon={Quote} label="Block quote" onAction={onQuote} />
      <ToolbarButton icon={Eraser} label="Clear formatting" onAction={onClear} />
    </div>
  );
}

type ToolbarButtonProps = {
  icon: LucideIcon;
  label: string;
  onAction: () => void;
};

function ToolbarButton({ icon: Icon, label, onAction }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="rounded-xl border-border/60 bg-card/70 text-foreground hover:bg-card"
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onAction();
      }}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function HorizontalRuler({ widthInches }: { widthInches: number }) {
  const wholeMarks = Math.floor(widthInches);
  const marks = Array.from({ length: wholeMarks + 1 }, (_, index) => index);
  const formatMark = (value: number) =>
    Math.abs(value - Math.round(value)) < 0.01 ? `${Math.round(value)} in` : `${value.toFixed(1)} in`;
  return (
    <div className="mb-2 h-8 rounded-lg border border-border/60 bg-card/70 px-4 py-1 text-[10px] text-muted-foreground">
      <div className="flex h-full items-end justify-between">
        {marks.map((mark) => (
          <span key={mark}>{formatMark(mark)}</span>
        ))}
        <span>{formatMark(widthInches)}</span>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildDocumentText(title: string, author: string, body: string) {
  const safeTitle = title?.trim() || "Untitled document";
  const header = [`${safeTitle}`, author ? `Author: ${author}` : "", ""].filter(Boolean).join("\n");
  return `${header}\n${body}`.trim();
}

function formatTimestamp(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Converts the editor markup to plain text for stats and exports.
function htmlToPlainText(html: string) {
  return html
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function estimateLineCount(html: string) {
  const normalized = html
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const segments = normalized.split(/\n/);
  return Math.max(segments.length, 1);
}

function readLocalDocuments(): SavedDocument[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Array<Partial<SavedDocument>>;
    return parsed
      .slice(0, MAX_SAVED_DOCS)
      .map((doc) => normalizeSavedDocumentShape(doc))
      .slice(0, MAX_SAVED_DOCS);
  } catch {
    return [];
  }
}

function persistLocalDocuments(documents: SavedDocument[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const limited = documents
      .slice(0, MAX_SAVED_DOCS)
      .map((doc) => normalizeSavedDocumentShape(doc));
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // ignore storage failures
  }
}

function inchesToPixels(value: number) {
  return Math.round(value * DPI);
}

function sanitizeMarginInput(raw: unknown, fallback: number) {
  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  const asInches = numeric > MAX_MARGIN_IN + 1 ? numeric / DPI : numeric;
  const clamped = Math.min(MAX_MARGIN_IN, Math.max(MIN_MARGIN_IN, asInches));
  return Math.round(clamped * 100) / 100;
}

function normalizeMarginsInput(input?: Partial<Margins> | Margins): Margins {
  const source = input ?? DEFAULT_MARGINS;
  return {
    top: sanitizeMarginInput(source.top, DEFAULT_MARGINS.top),
    right: sanitizeMarginInput(source.right, DEFAULT_MARGINS.right),
    bottom: sanitizeMarginInput(source.bottom, DEFAULT_MARGINS.bottom),
    left: sanitizeMarginInput(source.left, DEFAULT_MARGINS.left),
  };
}

function normalizeBorderSidesInput(input?: Partial<BorderSides>): BorderSides {
  const fallback = { ...DEFAULT_BORDER_SIDES };
  if (!input) return fallback;
  const result: BorderSides = { ...fallback };
  (Object.keys(fallback) as BorderSideKey[]).forEach((side) => {
    if (typeof input[side] === "boolean") {
      result[side] = input[side] as boolean;
    }
  });
  if (!Object.values(result).some(Boolean)) {
    return fallback;
  }
  return result;
}

function normalizeSavedDocumentShape(doc: Partial<SavedDocument>): SavedDocument {
  const normalizedMargins = normalizeMarginsInput(doc.margins);
  const normalizedSides = normalizeBorderSidesInput(doc.borderSides);
  const createdAt = doc.createdAt ?? new Date().toISOString();
  const updatedAt = doc.updatedAt ?? createdAt;
  return {
    id: doc.id ?? generateLocalDocumentId(),
    title: doc.title ?? "Untitled document",
    author: doc.author ?? "",
    content: doc.content ?? "",
    fontValue: doc.fontValue ?? "Inter",
    pageBorderStyle: (doc.pageBorderStyle as PageBorderStyle) ?? "none",
    borderSides: normalizedSides,
    lineNumbering: Boolean(doc.lineNumbering),
    margins: normalizedMargins,
    showRulers: doc.showRulers ?? true,
    createdAt,
    updatedAt,
  };
}

function generateLocalDocumentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
