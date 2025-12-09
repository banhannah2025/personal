
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const heroHighlights = ["Unified dashboard", "AI-assisted editors", "Household rituals"];

const suiteCards = [
  {
    title: "Life Dashboard",
    description: "Plan daily to yearly focus blocks, journals, and AI prompts from one cockpit.",
    link: "/app/life-dashboard",
    tag: "Planner",
  },
  {
    title: "Health Studio",
    description: "Track wellness budgets, care rituals, and family context for smarter nudges.",
    link: "/app/health-dashboard",
    tag: "Health",
  },
  {
    title: "GridFlow Sheets",
    description: "Spreadsheet-lite builder for KPIs, budgets, and sprint retros with CSV/XLSX export.",
    link: "/app/spreadsheet",
    tag: "Office",
  },
  {
    title: "Word Processor",
    description: "Rich doc editor with DOCX/PDF/TXT export, inch-based margins, and AI writing helpers.",
    link: "/app/word-processor",
    tag: "Office",
  },
  {
    title: "SlideShow Studio",
    description: "Template-ready deck builder with layout controls, image uploads, and PPTX export.",
    link: "/app/slideshow",
    tag: "Creator",
  },
  {
    title: "Digital Canvas",
    description: "Konva-powered design lab for cards, shapes, AI assets, and transparent PNG export.",
    link: "/app/digital-canvas",
    tag: "Creator",
  },
];

const blueprintSteps = [
  {
    title: "Start with your OS",
    body: "Use Life Dashboard + Health Studio to map priorities, budgets, and rituals. The dashboard detects whether you're logged in and loads your personalized console automatically.",
  },
  {
    title: "Launch tool tabs",
    body: "Every mini-app (Word Processor, SlideShow, GridFlow Sheets, Digital Canvas) lives inside the toolbox sidebar so switching contexts is instant.",
  },
  {
    title: "Ship outputs",
    body: "Export PDFs, DOCX, PPTX, transparent PNGs, or spreadsheets with one click. Use the Help Center for walkthroughs, keyboard tricks, and AI prompt ideas.",
  },
];

const helpPromos = [
  {
    title: "Getting started",
    body: "Follow the quick-start checklist to connect your Clerk account, tour the dashboard, and schedule your first planning block.",
    link: "/help#getting-started",
  },
  {
    title: "Tool playbooks",
    body: "Detailed guides for Word Processor, SlideShow Studio, GridFlow Sheets, Digital Canvas, and the Health/Learning studios.",
    link: "/help#tool-guides",
  },
  {
    title: "AI prompts & workflows",
    body: "See how we wire Groq + GPT automations for grammar help, rewrites, and slide drafting so you can extend them in your own rituals.",
    link: "/help#ai-workflows",
  },
];

const roadmap = [
  { label: "Q1", status: "Now shipping", detail: "Word Processor, SlideShow Studio, GridFlow Sheets" },
  { label: "Q2", status: "Next up", detail: "Digital Canvas AI upgrades + slideshow collaboration" },
  { label: "Q3", status: "Later", detail: "Automation rules, shared rituals, and pro exports" },
];

export default async function Home() {
  const { userId } = auth();
  if (userId) {
    redirect("/app");
  }
  return (
    <div className="space-y-16">
      <section className="overflow-hidden rounded-4xl border border-border/70 bg-gradient-to-br from-primary/15 via-background to-background px-10 py-16 shadow-2xl shadow-black/20">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-primary">
            CCPROS OS preview
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            One dashboard for household planning, wellness rituals, and AI creation tools
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Switch between Life Dashboard, Health Studio, and the creative toolbox (docs, slides, spreadsheets, graphics) without leaving your browser. Log in once and the OS remembers where you left off.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            {heroHighlights.map((item) => (
              <span key={item} className="rounded-full border border-border/60 px-4 py-1">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90"
            >
              Create account
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50"
            >
              Browse how-to guides
            </Link>
          </div>
        </div>
      </section>

      <section>
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Product suite</p>
        <h2 className="mt-3 text-3xl font-semibold">Pick the studio you need, stay in the same OS</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Dashboard navigation automatically routes signed-in members to the main console while guests see this landing page. Every tool below is wired into the floating toolbox sidebar so you can mix work, wellness, and creation flows.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {suiteCards.map((card) => (
            <article key={card.title} className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-lg shadow-black/5">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">{card.tag}</p>
              <h3 className="mt-2 text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
              <Link href={card.link} className="mt-4 inline-flex items-center text-sm font-semibold text-primary transition hover:underline">
                Launch {card.title}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-4xl border border-border/70 bg-background/80 p-8 shadow-black/5 shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">How it works</p>
        <h2 className="mt-3 text-3xl font-semibold">Blueprint for using CCPROS OS</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {blueprintSteps.map((step, index) => (
            <div key={step.title} className="rounded-3xl border border-border/60 bg-card/70 p-5">
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Step {index + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-4xl border border-border/70 bg-muted/20 p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>Help center</span>
          <span className="h-px flex-1 bg-border/70" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {helpPromos.map((promo) => (
            <article key={promo.title} className="rounded-3xl border border-border/60 bg-background/70 p-5">
              <h3 className="text-lg font-semibold">{promo.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{promo.body}</p>
              <Link href={promo.link} className="mt-4 inline-flex items-center text-sm font-semibold text-primary transition hover:underline">
                View section
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-4xl border border-border/70 bg-muted/30 p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>Roadmap</span>
          <span className="h-px flex-1 bg-border/70" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {roadmap.map((item) => (
            <div key={item.label} className="rounded-3xl border border-border/60 bg-background/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{item.label}</p>
              <h4 className="mt-2 text-lg font-semibold">{item.status}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Admin note: Code Manager remains a restricted console while we finish authentication guardrails for planners and wellness studios. Preview tools may change rapidly.
        </p>
      </section>
    </div>
  );
}
