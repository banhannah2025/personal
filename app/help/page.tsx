import Link from "next/link";
import type { Metadata } from "next";

const quickStart = [
  {
    title: "Create or sign in with Clerk",
    steps: [
      "Use the Sign Up button in the nav to create an account with email or passkey.",
      "Once verified, the landing page will automatically redirect you to /app each visit.",
      "Your dashboard tier determines which toolbox cards are instantly unlocked.",
    ],
  },
  {
    title: "Tour the toolbox sidebar",
    steps: [
      "Open the hamburger button on mobile to reveal the floating toolbox.",
      "Categories such as Creator, Office & Productivity, Learning, etc. help you find each mini-app.",
      "Pinned tools: Life Dashboard, Health Studio, Word Processor, SlideShow, GridFlow Sheets, Digital Canvas, AI Lab, Admin (restricted).",
    ],
  },
  {
    title: "Save your first items",
    steps: [
      "Most editors allow five saved items per user via Supabase RLS + local fallback.",
      "If you are offline, we cache to localStorage and sync when you come back.",
      "Use the Saved section on each page to load/delete drafts quickly.",
    ],
  },
];

const toolGuides = [
  {
    title: "Word Processor",
    tips: [
      "Rich text toolbar includes headings, bold/italic, lists, and AI helper modes (grammar or rewrite).",
      "Export via PDF, DOCX (docx package), or TXT. Margins are in inches (9.5 x 11 inch canvas).",
      "Page borders, line numbering, rulers, and Microsoft font list are available inside the collapsible controls section.",
    ],
    cta: { label: "Open Word Processor", href: "/app/word-processor" },
  },
  {
    title: "SlideShow Studio",
    tips: [
      "Use layout presets (text, split, hero) plus curated color themes and image uploads.",
      "Save up to five slide decks. Slides persist in Supabase with ids, notes, and backgrounds.",
      "Exports: PDF (jsPDF) and PPTX (pptxgenjs). PPTX respects layout + colors + uploaded assets.",
    ],
    cta: { label: "Open SlideShow Studio", href: "/app/slideshow" },
  },
  {
    title: "GridFlow Sheets",
    tips: [
      "Resize the grid, drag-select cells, and apply alignments, formats (text/number/currency/percent), and colors.",
      "Stats drawer shows count/sum/avg/min/max for numeric selections instantly.",
      "Export CSV (Blob) or XLSX (xlsx package). Supabase stores up to five sheets per user.",
    ],
    cta: { label: "Open GridFlow Sheets", href: "/app/spreadsheet" },
  },
  {
    title: "Digital Canvas",
    tips: [
      "Konva stage supports shapes (rect, circle, rounded cards, star, diamond, octagon variants), text blocks, lines, freehand + eraser tools.",
      "Upload assets, tap AI commands to modify elements, and export transparent PNGs.",
      "Use the inspector for layer order, font selection, stroke thickness, and background toggles (checkerboard shows transparency).",
    ],
    cta: { label: "Open Digital Canvas", href: "/app/digital-canvas" },
  },
  {
    title: "Health + Learning dashboards",
    tips: [
      "Life Dashboard = planner, journals, AI prompts. Health Studio = members, budgets, supplements.",
      "Research + Writing Cockpit now lives under Learning & Education inside the sidebar.",
      "Family Planner + Health consoles share data so prompts feel contextual.",
    ],
    cta: { label: "Visit dashboard", href: "/app" },
  },
];

const aiWorkflows = [
  {
    title: "Grammar + rewrite assistant",
    description:
      "Inside the Word Processor highlight text and choose Grammar or Rewrite. We call Groq models through /api/word-ai to return fixes without leaving the document.",
    steps: ["Highlight text", "Choose AI mode", "Review inline suggestion and apply"],
  },
  {
    title: "Slide AI inspiration",
    description:
      "SlideShow Studio uses Groq + image generation to suggest palettes and background assets. Use the AI actions in the top bar to draft placeholder copy or backgrounds.",
    steps: ["Open SlideShow", "Click AI actions", "Insert generated palettes/assets"],
  },
  {
    title: "Digital Canvas editing prompts",
    description:
      "Use the AI instruction input to describe layout tweaks (e.g., 'center all text blocks', 'change palette to blues'). We apply the returned transform to selected elements.",
    steps: ["Select items", "Enter instruction", "Approve preview"],
  },
];

const faq = [
  {
    q: "Why do I see the landing page when logged out but the dashboard when logged in?",
    a: "We detect Clerk auth state at the edge. Guests see this marketing page, members jump straight into /app so the toolbox and console load immediately.",
  },
  {
    q: "How many documents/slides/sheets can I save?",
    a: "Five per tool today. We enforce the limit via Supabase row-level security and mirror it locally for offline mode.",
  },
  {
    q: "Can I request a feature?",
    a: "Yes—use the AI Lab feedback form inside the Creator tab or email ops@ccpros.dev. We prioritize planner + health workflows first, then creation tools.",
  },
];

export const metadata: Metadata = {
  title: "CCPROS Help Center",
  description: "How-to guides, tool playbooks, and AI workflows for the CCPROS operating system.",
};

export default function HelpPage() {
  return (
    <div className="space-y-16">
      <section className="rounded-4xl border border-border/70 bg-gradient-to-br from-primary/5 via-background to-background p-8 shadow-xl shadow-black/10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Help Center</p>
        <h1 className="mt-4 text-4xl font-semibold">How to use every part of CCPROS</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          This page collects the latest guidance for the dashboard, toolbox, and AI-powered editors. Bookmark it and share with teammates who need a fast orientation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Link href="#getting-started" className="rounded-full border border-border/60 px-3 py-1 hover:text-foreground">
            Getting started
          </Link>
          <Link href="#tool-guides" className="rounded-full border border-border/60 px-3 py-1 hover:text-foreground">
            Tool guides
          </Link>
          <Link href="#ai-workflows" className="rounded-full border border-border/60 px-3 py-1 hover:text-foreground">
            AI workflows
          </Link>
          <Link href="#faq" className="rounded-full border border-border/60 px-3 py-1 hover:text-foreground">
            FAQ
          </Link>
        </div>
      </section>

      <section id="getting-started">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Start here</p>
        <h2 className="mt-3 text-3xl font-semibold">Getting started checklist</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {quickStart.map((item) => (
            <article key={item.title} className="rounded-3xl border border-border/70 bg-card/80 p-5">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {item.steps.map((step) => (
                  <li key={step}>• {step}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="tool-guides" className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Tool guides</p>
          <h2 className="mt-3 text-3xl font-semibold">How to use each mini-app</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Each guide mirrors the layout you will see once logged in. References to Supabase or Groq highlight what powers the feature behind the scenes.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {toolGuides.map((guide) => (
            <article key={guide.title} className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <h3 className="text-xl font-semibold">{guide.title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {guide.tips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
              <Link href={guide.cta.href} className="mt-4 inline-flex items-center text-sm font-semibold text-primary transition hover:underline">
                {guide.cta.label}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="ai-workflows" className="rounded-4xl border border-border/70 bg-muted/20 p-6">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">AI workflows</p>
        <h2 className="mt-3 text-3xl font-semibold">Prompt packs + automation notes</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {aiWorkflows.map((workflow) => (
            <article key={workflow.title} className="rounded-3xl border border-border/60 bg-background/70 p-5">
              <h3 className="text-lg font-semibold">{workflow.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{workflow.description}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-primary">3-step loop</p>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                {workflow.steps.map((step) => (
                  <li key={step}>• {step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section id="faq">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">FAQ</p>
        <h2 className="mt-3 text-3xl font-semibold">Common questions</h2>
        <div className="mt-5 space-y-4">
          {faq.map((item) => (
            <article key={item.q} className="rounded-3xl border border-border/60 bg-card/70 p-5">
              <h3 className="text-lg font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Need more help? Email <a href="mailto:ops@ccpros.dev" className="underline">ops@ccpros.dev</a> or ping us from the AI Lab feedback card.
        </p>
      </section>
    </div>
  );
}
