'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { jsPDF } from "jspdf";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SlideLayout = "text" | "split-left" | "split-right" | "full";
type SlideMediaFit = "contain" | "cover";

type Slide = {
  id: string;
  title: string;
  body: string;
  notes: string;
  background: string;
  titleColor: string;
  bodyColor: string;
  imageUrl: string;
  layout: SlideLayout;
  mediaFit: SlideMediaFit;
};

type SlideDeck = {
  id: string;
  title: string;
  description: string;
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
};

const MAX_DECKS = 5;
const STORAGE_KEY = "ccpros-slide-decks";

const DEFAULT_SLIDE = (): Slide => ({
  id: nanoid(),
  title: "Slide title",
  body: "Key talking points go here.",
  notes: "",
  background: "#ffffff",
  titleColor: "#0f172a",
  bodyColor: "#0f172a",
  imageUrl: "",
  layout: "text",
  mediaFit: "contain",
});

const LAYOUT_OPTIONS: Array<{ value: SlideLayout; label: string; hint: string }> = [
  { value: "text", label: "Text focus", hint: "Single column" },
  { value: "split-left", label: "Image left", hint: "Media beside text" },
  { value: "split-right", label: "Image right", hint: "Text beside media" },
  { value: "full", label: "Hero image", hint: "Image takes spotlight" },
];

const MEDIA_FIT_OPTIONS: Array<{ value: SlideMediaFit; label: string }> = [
  { value: "contain", label: "Contain" },
  { value: "cover", label: "Cover" },
];

const THEME_PRESETS = [
  { id: "modern", name: "Modern", background: "#eef2ff", titleColor: "#0f172a", bodyColor: "#312e81" },
  { id: "contrast", name: "Contrast", background: "#0f172a", titleColor: "#f8fafc", bodyColor: "#cbd5f5" },
  { id: "citrus", name: "Citrus", background: "#fff7ed", titleColor: "#9a3412", bodyColor: "#c2410c" },
  { id: "forest", name: "Forest", background: "#ecfccb", titleColor: "#14532d", bodyColor: "#1b4332" },
  { id: "slate", name: "Slate", background: "#f1f5f9", titleColor: "#0f172a", bodyColor: "#334155" },
];

const isSlideLayout = (value: unknown): value is SlideLayout =>
  typeof value === "string" && ["text", "split-left", "split-right", "full"].includes(value);

const isSlideMediaFit = (value: unknown): value is SlideMediaFit => typeof value === "string" && ["contain", "cover"].includes(value);

const hydrateSlide = (raw: Partial<Slide>): Slide => {
  const defaults = DEFAULT_SLIDE();
  return {
    ...defaults,
    ...raw,
    id: raw.id ?? defaults.id,
    layout: isSlideLayout(raw.layout) ? raw.layout : "text",
    mediaFit: isSlideMediaFit(raw.mediaFit) ? raw.mediaFit : "contain",
    titleColor: typeof raw.titleColor === "string" ? raw.titleColor : defaults.titleColor,
    bodyColor: typeof raw.bodyColor === "string" ? raw.bodyColor : defaults.bodyColor,
    background: typeof raw.background === "string" ? raw.background : defaults.background,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
  };
};

const SLIDE_TEMPLATES: Array<{ id: string; name: string; description: string; slides: Omit<Slide, "id">[] }> = [
  {
    id: "pitch",
    name: "Product Pitch",
    description: "Intro, problem, solution, and CTA.",
    slides: [
      {
        title: "Product name",
        body: "Elevator pitch\n• highlight your differentiator",
        notes: "",
        background: "#eef2ff",
        titleColor: "#0f172a",
        bodyColor: "#312e81",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
      {
        title: "Problem",
        body: "Describe the pain points your customers feel today.",
        notes: "",
        background: "#ffffff",
        titleColor: "#082f49",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "split-right",
        mediaFit: "cover",
      },
      {
        title: "Solution",
        body: "Explain how your product solves the problem.\nAdd key features as bullets.",
        notes: "",
        background: "#f1f5f9",
        titleColor: "#082f49",
        bodyColor: "#0f172a",
        imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=60",
        layout: "split-left",
        mediaFit: "cover",
      },
      {
        title: "Call to action",
        body: "Invite your audience to take the next step.",
        notes: "",
        background: "#ffffff",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
    ],
  },
  {
    id: "update",
    name: "Status Update",
    description: "Agenda, wins, blockers, and next steps.",
    slides: [
      {
        title: "Agenda",
        body: "1. Highlights\n2. Metrics\n3. Risks\n4. Next steps",
        notes: "",
        background: "#ffffff",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
      {
        title: "Highlights",
        body: "• Major win 1\n• Major win 2\n• Learning",
        notes: "",
        background: "#f8fafc",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=60",
        layout: "split-right",
        mediaFit: "cover",
      },
      {
        title: "Risks / blockers",
        body: "Summarize top risks and asks.",
        notes: "",
        background: "#fff7ed",
        titleColor: "#7c2d12",
        bodyColor: "#9a3412",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
      {
        title: "Next steps",
        body: "• Owner + task\n• Owner + task\n• Key date",
        notes: "",
        background: "#f1f5f9",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
    ],
  },
  {
    id: "webinar",
    name: "Webinar deck",
    description: "Problem framing, proof, and invitation.",
    slides: [
      {
        title: "Welcome",
        body: "Set the tone and share why the session matters.",
        notes: "",
        background: "#0f172a",
        titleColor: "#f8fafc",
        bodyColor: "#cbd5f5",
        imageUrl: "https://images.unsplash.com/photo-1515162305285-533c3cd80c23?auto=format&fit=crop&w=900&q=60",
        layout: "full",
        mediaFit: "cover",
      },
      {
        title: "Agenda",
        body: "• Story so far\n• Live walkthrough\n• Next steps",
        notes: "",
        background: "#f8fafc",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
      {
        title: "Social proof",
        body: "Quote or stat that builds trust.",
        notes: "",
        background: "#e0f2fe",
        titleColor: "#0f172a",
        bodyColor: "#075985",
        imageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=900&q=60",
        layout: "split-left",
        mediaFit: "cover",
      },
      {
        title: "CTA",
        body: "Invite everyone to book a call or start a trial.",
        notes: "",
        background: "#ffffff",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
    ],
  },
  {
    id: "case-study",
    name: "Case Study",
    description: "Problem, approach, impact, lessons.",
    slides: [
      {
        title: "Client snapshot",
        body: "Industry, size, time frame.",
        notes: "",
        background: "#ecfccb",
        titleColor: "#14532d",
        bodyColor: "#1b4332",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
      {
        title: "Challenge",
        body: "What was broken? Quantify it.",
        notes: "",
        background: "#ffffff",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=60",
        layout: "split-right",
        mediaFit: "cover",
      },
      {
        title: "Approach",
        body: "Steps you took or features that mattered.",
        notes: "",
        background: "#f1f5f9",
        titleColor: "#0f172a",
        bodyColor: "#0f172a",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
      {
        title: "Impact",
        body: "Metric before → after, plus testimonial.",
        notes: "",
        background: "#ecfccb",
        titleColor: "#14532d",
        bodyColor: "#1b4332",
        imageUrl: "",
        layout: "text",
        mediaFit: "contain",
      },
    ],
  },
];

export default function SlideShowPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [title, setTitle] = useState("Untitled slideshow");
  const [description, setDescription] = useState("");
  const [slides, setSlides] = useState<Slide[]>([DEFAULT_SLIDE()]);
  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.id ?? "");
  const [savedDecks, setSavedDecks] = useState<SlideDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const activeThemeId = useMemo(() => {
    if (!activeSlide) return null;
    const match = THEME_PRESETS.find(
      (theme) =>
        theme.background === activeSlide.background &&
        theme.titleColor === activeSlide.titleColor &&
        theme.bodyColor === activeSlide.bodyColor
    );
    return match?.id ?? null;
  }, [activeSlide]);
  const isAtLimit = !activeDeckId && savedDecks.length >= MAX_DECKS;

  const setSlideField = <K extends keyof Slide>(field: K, value: Slide[K]) => {
    setSlides((prev) => prev.map((slide) => (slide.id === activeSlideId ? { ...slide, [field]: value } : slide)));
  };

  const addSlide = () => {
    const newSlide = DEFAULT_SLIDE();
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideId(newSlide.id);
  };

  const duplicateSlide = (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;
    const clone = { ...slide, id: nanoid(), title: `${slide.title} copy` };
    setSlides((prev) => {
      const index = prev.findIndex((item) => item.id === slideId);
      const result = [...prev];
      result.splice(index + 1, 0, clone);
      return result;
    });
    setActiveSlideId(clone.id);
  };

  const deleteSlide = (slideId: string) => {
    setSlides((prev) => {
      if (prev.length === 1) {
        const replacement = DEFAULT_SLIDE();
        setActiveSlideId(replacement.id);
        return [replacement];
      }
      const filtered = prev.filter((slide) => slide.id !== slideId);
      if (activeSlideId === slideId && filtered.length) {
        setActiveSlideId(filtered[0].id);
      }
      return filtered;
    });
  };

  const normalizeDeck = (raw: Partial<SlideDeck>): SlideDeck => {
    const now = raw.updatedAt ?? new Date().toISOString();
    return {
      id: raw.id ?? generateLocalId(),
      title: raw.title ?? "Untitled slideshow",
      description: raw.description ?? "",
      slides:
        Array.isArray(raw.slides) && raw.slides.length > 0
          ? raw.slides.map((slide) => hydrateSlide(slide as Partial<Slide>))
          : [DEFAULT_SLIDE()],
      createdAt: raw.createdAt ?? now,
      updatedAt: now,
    };
  };

  const applyTemplate = (templateId: string) => {
    const template = SLIDE_TEMPLATES.find((tpl) => tpl.id === templateId);
    if (!template) return;
    const templateSlides = template.slides.map((slide) =>
      hydrateSlide({
        ...slide,
        id: nanoid(),
      })
    );
    setSlides(templateSlides);
    setActiveSlideId(templateSlides[0]?.id ?? templateSlides[templateSlides.length - 1]?.id ?? "");
    setTitle(template.name);
    setDescription(template.description);
  };

  const persistLocalDecks = (decks: SlideDeck[]) => {
    if (typeof window === "undefined") return;
    const slice = decks.slice(0, MAX_DECKS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
    setSavedDecks(slice);
  };

  const handleThemeApply = (themeId: string) => {
    const theme = THEME_PRESETS.find((item) => item.id === themeId);
    if (!theme || !activeSlideId) return;
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === activeSlideId
          ? { ...slide, background: theme.background, titleColor: theme.titleColor, bodyColor: theme.bodyColor }
          : slide
      )
    );
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSlideField("imageUrl", reader.result);
      }
      setImageUploading(false);
    };
    reader.onerror = () => {
      setImageUploading(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const clearSlideImage = () => {
    setSlideField("imageUrl", "");
  };

  const loadLocalDecks = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as SlideDeck[];
      return parsed.slice(0, MAX_DECKS).map((deck) => normalizeDeck(deck));
    } catch {
      return [];
    }
  }, []);

  const handleSave = async () => {
    if (isAtLimit) {
      setErrorMessage("Delete an existing slideshow to save another (limit 5).");
      return;
    }
    const deckPayload: SlideDeck = {
      id: activeDeckId ?? generateLocalId(),
      title: title.trim() || "Untitled slideshow",
      description: description.trim(),
      slides,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!isSignedIn) {
      persistLocalDecks([deckPayload, ...savedDecks.filter((deck) => deck.id !== deckPayload.id)]);
      setActiveDeckId(deckPayload.id);
      setErrorMessage(null);
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/slide-decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeDeckId ?? undefined,
          title: deckPayload.title,
          description: deckPayload.description,
          slides: deckPayload.slides,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save deck");
      const saved = normalizeDeck(data.deck);
      persistLocalDecks([saved, ...savedDecks.filter((deck) => deck.id !== saved.id)]);
      setActiveDeckId(saved.id);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!isSignedIn) {
      persistLocalDecks(savedDecks.filter((deck) => deck.id !== deckId));
      if (activeDeckId === deckId) {
        setActiveDeckId(null);
      }
      return;
    }
    try {
      const response = await fetch("/api/slide-decks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deckId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete deck");
      persistLocalDecks(savedDecks.filter((deck) => deck.id !== deckId));
      if (activeDeckId === deckId) {
        setActiveDeckId(null);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleLoadDeck = (deck: SlideDeck) => {
    setTitle(deck.title);
    setDescription(deck.description);
    setSlides(deck.slides.length ? deck.slides : [DEFAULT_SLIDE()]);
    setActiveSlideId(deck.slides[0]?.id ?? deck.slides[deck.slides.length - 1]?.id ?? "");
    setActiveDeckId(deck.id);
  };

  const loadDecks = useCallback(async () => {
    if (!isSignedIn) {
      const local = loadLocalDecks();
      setSavedDecks(local);
      return;
    }
    if (!isLoaded) return;
    setLoadingDecks(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/slide-decks");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch slide decks");
      const decks = (data.decks ?? []).map((deck: SlideDeck) => normalizeDeck(deck));
      persistLocalDecks(decks);
    } catch (error) {
      setErrorMessage((error as Error).message);
      const fallback = loadLocalDecks();
      setSavedDecks(fallback);
    } finally {
      setLoadingDecks(false);
    }
  }, [isLoaded, isSignedIn, loadLocalDecks]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", orientation: "landscape", format: "letter" });
    slides.forEach((slide, index) => {
      if (index > 0) doc.addPage();
      const titleRgb = hexToRgb(slide.titleColor || "#0f172a");
      doc.setTextColor(titleRgb.r, titleRgb.g, titleRgb.b);
      doc.setFontSize(24);
      doc.text(slide.title, 60, 80);
      const bodyRgb = hexToRgb(slide.bodyColor || "#0f172a");
      doc.setTextColor(bodyRgb.r, bodyRgb.g, bodyRgb.b);
      doc.setFontSize(14);
      const bodyLines = doc.splitTextToSize(slide.body, 640);
      doc.text(bodyLines, 60, 140);
    });
    doc.save(`${title.trim() || "slideshow"}.pdf`);
  };

  const downloadPptx = async () => {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();
    slides.forEach((slide) => {
      const s = pptx.addSlide();
      s.background = { color: slide.background || "#ffffff" };
      s.addText(slide.title || "", {
        x: 0.5,
        y: 0.4,
        w: 9,
        h: 0.9,
        fontSize: 32,
        bold: true,
        color: slide.titleColor || "#0f172a",
      });
      const imageSrc = slide.imageUrl?.trim();
      const addImage = (box: { x: number; y: number; w: number; h: number }) => {
        if (!imageSrc) return;
        const imagePayload: Record<string, unknown> = {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
        };
        if (slide.mediaFit === "cover") {
          imagePayload.sizing = { type: "cover", w: box.w, h: box.h };
        }
        if (imageSrc.startsWith("data:")) {
          imagePayload.data = imageSrc;
        } else {
          imagePayload.path = imageSrc;
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          s.addImage(imagePayload as any);
        } catch {
          // ignore addImage failures so export still works
        }
      };

      let bodyBox = { x: 0.5, y: 1.4, w: 9, h: 4.6 };
      if (slide.layout === "split-left") {
        addImage({ x: 0.5, y: 1.2, w: 4, h: 4.6 });
        bodyBox = { x: 4.8, y: 1.2, w: 4.8, h: 4.6 };
      } else if (slide.layout === "split-right") {
        bodyBox = { x: 0.5, y: 1.2, w: 4.8, h: 4.6 };
        addImage({ x: 5.6, y: 1.2, w: 3.9, h: 4.6 });
      } else if (slide.layout === "full") {
        addImage({ x: 0.5, y: 1, w: 9, h: 4.8 });
        bodyBox = { x: 0.8, y: 1.2, w: 8.5, h: 4.2 };
      } else {
        addImage({ x: 0.5, y: 4, w: 4.2, h: 2.8 });
      }

      s.addText(slide.body || "", {
        ...bodyBox,
        fontSize: 20,
        color: slide.bodyColor || "#0f172a",
      });
      if (slide.notes?.trim()) {
        (s as { addNotes?: (text: string) => void }).addNotes?.(slide.notes);
      }
    });
    await pptx.writeFile({ fileName: `${title.trim() || "slideshow"}.pptx` });
  };

  const deckSummary = useMemo(() => {
    if (!slides.length) return "No slides yet";
    return `${slides.length} slide${slides.length === 1 ? "" : "s"} ready to export.`;
  }, [slides.length]);

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Office & Productivity</p>
          <h1 className="text-3xl font-semibold">SlideShow Studio</h1>
          <p className="text-sm text-muted-foreground">
            Draft presentation slides with flexible layouts, drop in imagery, tap template packs, capture speaker notes, and export to PDF or PPTX.
            Store up to five slide decks per account.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[18rem,1fr]">
          <aside className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-inner shadow-black/10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Deck info</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                placeholder="Slideshow title"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 h-20 w-full rounded-2xl border border-border/60 bg-card/80 p-2 text-sm"
                placeholder="Optional description or agenda"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Slides ({slides.length})</p>
              <div className="mt-3 space-y-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition",
                      slide.id === activeSlideId
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/50 bg-card/70 hover:border-border"
                    )}
                    onClick={() => setActiveSlideId(slide.id)}
                  >
                    <span className="truncate">
                      {index + 1}. {slide.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{slide.background}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={addSlide}>
                  Add slide
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => duplicateSlide(activeSlideId)}
                  disabled={!activeSlide}
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteSlide(activeSlideId)}
                  disabled={!activeSlide}
                >
                  Delete
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Templates</p>
              <div className="mt-3 space-y-2">
                {SLIDE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className="w-full rounded-2xl border border-dashed border-border/50 bg-card/70 px-3 py-2 text-left text-sm hover:border-border"
                    onClick={() => applyTemplate(template.id)}
                  >
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Exports</p>
                  <p className="text-[11px] text-muted-foreground">Download as PDF or PPTX whenever you are ready.</p>
                </div>
                {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="flex-1 rounded-2xl" onClick={downloadPdf}>
                  Download PDF
                </Button>
                <Button type="button" variant="secondary" className="flex-1 rounded-2xl" onClick={downloadPptx}>
                  Download PPTX
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" variant="default" className="rounded-2xl" onClick={handleSave} disabled={saving}>
                  Save slideshow
                </Button>
                {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Saved decks</p>
                  <p className="text-[11px] text-muted-foreground">Limit {MAX_DECKS} per account.</p>
                </div>
                {loadingDecks && <span className="text-xs text-muted-foreground">Loading…</span>}
              </div>
              <div className="mt-3 space-y-2">
                {savedDecks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No slideshows saved yet.</p>
                ) : (
                  savedDecks.map((deck) => (
                    <div
                      key={deck.id}
                      className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/80 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{deck.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {deck.slides.length} slides • {new Date(deck.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleLoadDeck(deck)}>
                          Load
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteDeck(deck.id)}>
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
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Slide editor</p>
                {activeSlide ? (
                  <div className="mt-3 space-y-3">
                    <input
                      value={activeSlide.title}
                      onChange={(event) => setSlideField("title", event.target.value)}
                      className="w-full rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
                      placeholder="Slide title"
                    />
                    <textarea
                      value={activeSlide.body}
                      onChange={(event) => setSlideField("body", event.target.value)}
                      className="h-32 w-full rounded-2xl border border-border/60 bg-card/80 p-3 text-sm"
                      placeholder="Slide body text"
                    />
                    <textarea
                      value={activeSlide.notes}
                      onChange={(event) => setSlideField("notes", event.target.value)}
                      className="h-20 w-full rounded-2xl border border-border/60 bg-card/80 p-3 text-sm"
                      placeholder="Speaker notes"
                    />

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-border/50 bg-card/70 p-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Layouts</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {LAYOUT_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={cn(
                                "rounded-2xl border px-3 py-2 text-left text-xs",
                                activeSlide.layout === option.value
                                  ? "border-primary/60 bg-primary/10 text-primary"
                                  : "border-border/50 bg-background/70 hover:border-border"
                              )}
                              onClick={() => setSlideField("layout", option.value)}
                            >
                              <span className="block font-medium">{option.label}</span>
                              <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/50 bg-card/70 p-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Theme presets</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Apply curated color combos.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {THEME_PRESETS.map((theme) => (
                            <button
                              key={theme.id}
                              type="button"
                              className={cn(
                                "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs",
                                activeThemeId === theme.id
                                  ? "border-primary/60 bg-primary/10 text-primary"
                                  : "border-border/50 bg-background/70 hover:border-border"
                              )}
                              onClick={() => handleThemeApply(theme.id)}
                            >
                              <span
                                className="h-5 w-5 rounded-full border border-border/50"
                                style={{ background: theme.background }}
                              />
                              <span className="font-medium">{theme.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-card/70 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Media</p>
                          <p className="text-[11px] text-muted-foreground">Paste a URL or upload directly.</p>
                        </div>
                        {imageUploading && <span className="text-[11px] text-muted-foreground">Processing…</span>}
                      </div>
                      <input
                        value={activeSlide.imageUrl}
                        onChange={(event) => setSlideField("imageUrl", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                        placeholder="https:// or data:image/png;base64,..."
                      />
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                          Upload image
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={clearSlideImage} disabled={!activeSlide.imageUrl}>
                          Remove
                        </Button>
                      </div>
                      <label className="mt-3 flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Image fit</span>
                        <select
                          value={activeSlide.mediaFit}
                          onChange={(event) => setSlideField("mediaFit", event.target.value as SlideMediaFit)}
                          className="rounded-xl border border-border/60 bg-card/80 px-2 py-1 text-xs"
                        >
                          {MEDIA_FIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="flex flex-col rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Background</span>
                        <input
                          type="color"
                          value={activeSlide.background}
                          onChange={(event) => setSlideField("background", event.target.value)}
                          className="mt-2 h-10 w-full rounded-xl border border-border/60 bg-card/70"
                        />
                      </label>
                      <label className="flex flex-col rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Title color</span>
                        <input
                          type="color"
                          value={activeSlide.titleColor}
                          onChange={(event) => setSlideField("titleColor", event.target.value)}
                          className="mt-2 h-10 w-full rounded-xl border border-border/60 bg-card/70"
                        />
                      </label>
                      <label className="flex flex-col rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Body color</span>
                        <input
                          type="color"
                          value={activeSlide.bodyColor}
                          onChange={(event) => setSlideField("bodyColor", event.target.value)}
                          className="mt-2 h-10 w-full rounded-xl border border-border/60 bg-card/70"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a slide to begin editing.</p>
                )}
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Preview</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {slides.map((slide) => {
                    const layoutLabel = LAYOUT_OPTIONS.find((option) => option.value === slide.layout)?.label ?? "Text focus";
                    const mediaClass =
                      slide.layout === "full"
                        ? "h-44 w-full"
                        : slide.layout === "text"
                        ? "h-28 w-full"
                        : "h-32 w-full sm:w-36";
                    const mediaNode =
                      slide.imageUrl ? (
                        <div className={cn("overflow-hidden rounded-xl border border-border/30 bg-white/40", mediaClass)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={slide.imageUrl}
                            alt={slide.title}
                            className="h-full w-full"
                            style={{ objectFit: slide.mediaFit === "cover" ? "cover" : "contain" }}
                            loading="lazy"
                          />
                        </div>
                      ) : null;

                    const textBlock = (
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{layoutLabel}</span>
                          {slide.notes && <span>Notes saved</span>}
                        </div>
                        <h3 className="mt-1 text-base font-semibold" style={{ color: slide.titleColor }}>
                          {slide.title}
                        </h3>
                        <p className="mt-2 text-xs" style={{ color: slide.bodyColor }}>
                          {slide.body}
                        </p>
                      </div>
                    );

                    return (
                      <div
                        key={slide.id}
                        className={cn(
                          "space-y-3 rounded-2xl border border-border/40 p-3 text-sm transition",
                          slide.id === activeSlideId && "border-primary"
                        )}
                        style={{ backgroundColor: slide.background }}
                      >
                        {slide.layout === "full" ? (
                          <div className="space-y-3">
                            {mediaNode}
                            {textBlock}
                          </div>
                        ) : slide.layout === "split-left" || slide.layout === "split-right" ? (
                          <div className="flex flex-col gap-3 sm:flex-row">
                            {slide.layout === "split-left" && mediaNode}
                            <div className="flex-1">{textBlock}</div>
                            {slide.layout === "split-right" && mediaNode}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {textBlock}
                            {mediaNode}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Summary</p>
                <p className="mt-2 text-sm text-muted-foreground">{deckSummary}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function generateLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hexToRgb(hex: string) {
  if (!hex) return { r: 15, g: 23, b: 42 };
  const normalized = hex.replace("#", "").trim();
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  if (expanded.length !== 6) return { r: 15, g: 23, b: 42 };
  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return { r: 15, g: 23, b: 42 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
