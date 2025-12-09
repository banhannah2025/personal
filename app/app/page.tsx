"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  LineChart,
  Lock,
  Menu,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deriveTierFromMetadata, type SubscriptionTierId } from "@/lib/subscription";
import { isAdminFromMetadata } from "@/lib/roles";

type TierId = SubscriptionTierId;

type SubscriptionTier = {
  id: TierId;
  label: string;
  price: string;
  tagline: string;
  description: string;
  highlights: string[];
};

type ToolLauncher = {
  id: string;
  name: string;
  description: string;
  href: string;
  pillar: string;
  metricLabel: string;
  metricValue: string;
  minTier: TierId;
  status: "live" | "beta" | "preview" | "internal";
  requiresAdmin?: boolean;
};

type AnnotatedLauncher = ToolLauncher & {
  locked: boolean;
  badgeLabel: string;
  hasAccess: boolean;
  previewHasAccess: boolean;
};

type RitualQueueItem = {
  id: string;
  title: string;
  summary: string;
  actionLabel: string;
  href: string;
  relatedTool: string;
};

type SignalCard = {
  id: string;
  label: string;
  metric: string;
  detail: string;
  trend: string;
};

const tierOrder: TierId[] = ["free", "plus", "pro"];

const subscriptionTiers: SubscriptionTier[] = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    tagline: "Family care essentials",
    description: "Family Planner + Health Studio with core AI reflections.",
    highlights: [
      "Household member + meal tracking",
      "Shared care budgets + journals",
      "Weekly AI nudges",
    ],
  },
  {
    id: "plus",
    label: "Plus",
    price: "$20",
    tagline: "Productivity + docs",
    description: "Everything in Free plus Life Planner and the Word Processor.",
    highlights: [
      "Daily → yearly life planner",
      "Export-ready word editor",
      "Offline-safe autosave",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    price: "$40",
    tagline: "Full studio + GPT-5",
    description: "Unlock every CCPROS workspace with GPT-5 powering most tasks.",
    highlights: [
      "Slides, sheets, and design tools",
      "Academic + legal workspaces",
      "Case Management Studio + Legal Projects",
      "GPT-5 copilots for most tasks",
    ],
  },
];

const toolLaunchers: ToolLauncher[] = [
  {
    id: "family",
    name: "Family Planner",
    description: "Coordinate meals, routines, and member notes inside one shared board.",
    href: "/app/life-dashboard",
    pillar: "Household",
    metricLabel: "Next ritual",
    metricValue: "Meal plan sync tonight",
    minTier: "free",
    status: "live",
  },
  {
    id: "health",
    name: "Health Studio",
    description: "Household wellness budgets, member profiles, and journal cadence.",
    href: "/app/health-dashboard",
    pillar: "Health",
    metricLabel: "Last check-in",
    metricValue: "Yesterday · 2 members updated",
    minTier: "free",
    status: "beta",
  },
  {
    id: "life",
    name: "Life Planner",
    description: "Daily → yearly planning cockpit with focus, journals, and AI prompts.",
    href: "/app/life-dashboard",
    pillar: "Planner",
    metricLabel: "Next action",
    metricValue: "Reflection block at 4:00p",
    minTier: "plus",
    status: "live",
  },
  {
    id: "word-processor",
    name: "Word Processor",
    description: "Draft notes, memos, or briefs with DOCX/PDF/TXT export + AI helpers.",
    href: "/app/word-processor",
    pillar: "Docs",
    metricLabel: "Recent doc",
    metricValue: "Quarterly update in progress",
    minTier: "plus",
    status: "beta",
  },
  {
    id: "case-management",
    name: "Case Management Studio",
    description: "Intake parties, track facts, and link AI legal research to each matter.",
    href: "/app/case-management",
    pillar: "Career",
    metricLabel: "Focus matter",
    metricValue: "Estate dispute in discovery",
    minTier: "pro",
    status: "beta",
  },
  {
    id: "slideshow",
    name: "SlideShow Studio",
    description: "Template-ready deck builder with layout presets and speaker notes.",
    href: "/app/slideshow",
    pillar: "Creator",
    metricLabel: "Active deck",
    metricValue: "Roadshow slides 45% done",
    minTier: "pro",
    status: "beta",
  },
  {
    id: "gridflow",
    name: "GridFlow Sheets",
    description: "Spreadsheet-lite tracker with drag selection, stats, and CSV/XLSX export.",
    href: "/app/spreadsheet",
    pillar: "Office",
    metricLabel: "Latest sheet",
    metricValue: "Budget tracker balanced",
    minTier: "pro",
    status: "beta",
  },
  {
    id: "digital-canvas",
    name: "Digital Canvas",
    description: "Drag, drop, and prompt AI for graphics, color palettes, and layouts.",
    href: "/app/digital-canvas",
    pillar: "Arts & Crafts",
    metricLabel: "Latest board",
    metricValue: "Moodboard ready",
    minTier: "pro",
    status: "beta",
  },
  {
    id: "academics",
    name: "Academic Studio",
    description: "Coursework planning, resource mapping, and mentor accountability.",
    href: "/app/academics",
    pillar: "Academics",
    metricLabel: "Active projects",
    metricValue: "Capstone brief roughed in",
    minTier: "pro",
    status: "beta",
  },
  {
    id: "legal",
    name: "Legal Projects",
    description: "Matter trackers, filings, and partner-ready update briefs.",
    href: "/app/legal-projects",
    pillar: "Compliance",
    metricLabel: "Open matters",
    metricValue: "3 preparing for review",
    minTier: "pro",
    status: "live",
  },
  {
    id: "ai",
    name: "AI Training Lab",
    description: "Corpus ingest, prompt templates, and GPT-5 retraining controls.",
    href: "/app/ai-training",
    pillar: "AI Lab",
    metricLabel: "Latest session",
    metricValue: "Legal fine-tune queued",
    minTier: "pro",
    status: "preview",
    requiresAdmin: true,
  },
  {
    id: "admin",
    name: "Admin Workbench",
    description: "Assistant console, knowledge tools, and the Code Manager.",
    href: "/app/admin",
    pillar: "Admin",
    metricLabel: "Pending reviews",
    metricValue: "2 patch threads",
    minTier: "pro",
    status: "internal",
    requiresAdmin: true,
  },
];

const ritualQueue: RitualQueueItem[] = [
  {
    id: "planner-review",
    title: "Weekly sprint review",
    summary: "Roll Life Dashboard focus cards into the coming week and refresh AI prompts.",
    actionLabel: "Open planner",
    href: "/app/life-dashboard",
    relatedTool: "Life Dashboard",
  },
  {
    id: "health-journal",
    title: "Care + meal journal",
    summary: "Log meals and medication updates so the household budget stays accurate.",
    actionLabel: "Log a health entry",
    href: "/app/health-dashboard",
    relatedTool: "Health Studio",
  },
  {
    id: "academic-block",
    title: "Capstone deep work",
    summary: "Use Academic Studio to break the research outline into 3 actionable cards.",
    actionLabel: "Plan academic block",
    href: "/app/academics",
    relatedTool: "Academic Studio",
  },
  {
    id: "ai-session",
    title: "AI session QA",
    summary: "Review the GPT-5.1 training session logs before enabling automations.",
    actionLabel: "Review sessions",
    href: "/app/ai-training",
    relatedTool: "AI Training Lab",
  },
];

const signalCards: SignalCard[] = [
  {
    id: "momentum",
    label: "Momentum",
    metric: "3 / 4 focus blocks booked",
    detail: "Life Dashboard · Weekly sprint ready",
    trend: "+1 card vs last week",
  },
  {
    id: "health",
    label: "Health cadence",
    metric: "2 care journals logged",
    detail: "Budget variance +$45",
    trend: "Need entry today",
  },
  {
    id: "academics",
    label: "Academic load",
    metric: "1 milestone blocked",
    detail: "Capstone due Thursday",
    trend: "Mentor notes pending",
  },
  {
    id: "legal",
    label: "Legal runway",
    metric: "3 briefs in drafting",
    detail: "Compliance studio stable",
    trend: "2 reviews queued",
  },
];

type ToolboxTool = {
  id: string;
  title: string;
  description: string;
  status: string;
  hint: string;
  actionLabel: string;
  href: string;
};

type ToolboxCategory = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  tools?: ToolboxTool[];
};

type ResearchTrackSummary = {
  id: string;
  topic: string;
  question: string;
  timeframe: string;
  status: string;
  created_at: string;
};

type WritingDraftSummary = {
  id: string;
  title: string;
  focus: string;
  status: string;
  summary: string;
  created_at: string;
};

type ResearchSourceSummary = {
  id: string;
  title: string;
  type: string;
  link: string;
  reliability: string;
  created_at: string;
};

type AcademicProjectSummary = {
  id: string;
  title: string;
  question: string;
  updated_at: string;
  created_at: string;
};

type LegalProjectSummary = {
  id: string;
  title: string;
  question: string;
  session_id: string | null;
  updated_at: string;
  created_at: string;
};

const rawToolboxCategories: ToolboxCategory[] = [
  {
    id: "arts-and-crafts",
    label: "Arts and Crafts",
    description: "Creative routines, maker prompts, and tactile learning kits.",
    placeholder: "Sketchbooks, maker kits, and ritual cards will appear here soon.",
    tools: [
      {
        id: "digital-canvas",
        title: "Digital Canvas",
        description: "Design ritual cards, posters, or collage boards with drag-and-drop layers.",
        status: "Beta",
        hint: "AI background, palette, and layout helpers live inside the mini-app.",
        actionLabel: "Open Digital Canvas",
        href: "/app/digital-canvas",
      },
    ],
  },
  {
    id: "creator",
    label: "Creator",
    description: "Content studios, publishing helpers, and audience rituals.",
    placeholder: "Creator operating tools are on the roadmap. Pin ideas here as they surface.",
    tools: [
      {
        id: "ai-lab",
        title: "AI Training Lab",
        description:
          "Monitor corpora, session health, and prompt templates without leaving the dashboard.",
        status: "Preview",
        hint: "Admin-only. Request access from CCPROS operations.",
        actionLabel: "Open full lab",
        href: "/app/ai-training",
      },
    ],
  },
  {
    id: "games",
    label: "Games",
    description: "Play lists, household quests, and AI-generated challenges.",
    placeholder: "Mini-games and prompts will live here once the arcade ships.",
  },
  {
    id: "family-and-household",
    label: "Family and Household",
    description: "Home rituals, care budgets, and shared household planning.",
    placeholder: "Household AI tools will drop here soon.",
    tools: [
      {
        id: "family-planner",
        title: "Family Planner",
        description: "Tie household members, meals, and routines to your daily planning blocks.",
        status: "Preview",
        hint: "Use the dashboard widgets below to get started.",
        actionLabel: "Open life planner",
        href: "/app/life-dashboard",
      },
      {
        id: "health-studio",
        title: "Health Studio",
        description: "Track members, budgets, journals, and AI recommendations for family care.",
        status: "Live",
        hint: "Manage care context from the inline health console.",
        actionLabel: "Open health studio",
        href: "/app/health-dashboard",
      },
    ],
  },
  {
    id: "learning-and-education",
    label: "Learning and Education",
    description: "Study copilots, lesson builders, and academic review loops.",
    placeholder: "Course planners and tutoring flows will plug in here shortly.",
    tools: [
      {
        id: "research-writing",
        title: "Research + Writing Cockpit",
        description: "Run AI research, manage reading lists, and draft briefs from one studio.",
        status: "Live",
        hint: "Academic Studio keeps prompts, drafts, and sources aligned.",
        actionLabel: "Open cockpit",
        href: "/app/academics",
      },
    ],
  },
  {
    id: "office-and-productivity",
    label: "Office and Productivity",
    description: "Meeting rituals, task boards, and compliance automations.",
    placeholder: "Workspace automations will populate this tab next.",
    tools: [
      {
        id: "planner",
        title: "Life Planner",
        description: "Daily → yearly focus tracking, notes, and AI prompts for your household OS.",
        status: "Live",
        hint: "Use the console below for a quick view.",
        actionLabel: "Open planner",
        href: "/app/life-dashboard",
      },
      {
        id: "admin-workbench",
        title: "Admin Workbench",
        description: "Code manager, assistant console, and operations toolkit for trusted admins.",
        status: "Restricted",
        hint: "Admin-only. Request access from CCPROS operations.",
        actionLabel: "Open admin",
        href: "/app/admin",
      },
      {
        id: "word-processor",
        title: "Word Processor",
        description: "Draft documents, notes, and updates with export-ready formatting.",
        status: "Beta",
        hint: "Save work locally as PDF, DOCX, or TXT with one click.",
        actionLabel: "Open word processor",
        href: "/app/word-processor",
      },
      {
        id: "slideshow",
        title: "SlideShow Studio",
        description: "Build presentation decks with speaker notes and AI helpers.",
        status: "Beta",
        hint: "Store up to five slide decks per account.",
        actionLabel: "Open slideshow",
        href: "/app/slideshow",
      },
      {
        id: "spreadsheet",
        title: "GridFlow Sheets",
        description: "Track KPIs, personal budgets, or sprint data with a lightweight grid.",
        status: "Beta",
        hint: "Save up to five sheets and export anytime.",
        actionLabel: "Open sheets",
        href: "/app/spreadsheet",
      },
    ],
  },
  {
    id: "career-professionals",
    label: "Career Professionals",
    description: "Case management, legal research, and professional services workflows.",
    placeholder: "More professional toolkits arrive soon.",
    tools: [
      {
        id: "case-management",
        title: "Case Management Studio",
        description: "Manage parties, evidence, and authority with AI linked to Legal Projects.",
        status: "Beta",
        hint: "Case intake + legal research live side-by-side.",
        actionLabel: "Open case studio",
        href: "/app/case-management",
      },
      {
        id: "legal-projects",
        title: "Legal Projects",
        description: "Matter trackers, research briefs, and GPT-5-powered drafting loops.",
        status: "Live",
        hint: "Push research sessions into AI Lab + Legal Projects",
        actionLabel: "Open legal workspace",
        href: "/app/legal-projects",
      },
    ],
  },
  {
    id: "social",
    label: "Social",
    description: "Community rituals, shared updates, and upcoming salons.",
    placeholder: "Shared rituals + community prompts will live here once social beta launches.",
  },
];

const toolboxCategories = [...rawToolboxCategories].sort((a, b) => a.label.localeCompare(b.label));

type AiLabDomain = "legal" | "academic";

type AiLabOverview = {
  corporaTotal: number;
  documentTotal: number;
  activeSessions: number;
  queuedSessions: number;
  corpora: Array<{ id: string; name: string; documents: number }>;
};

const AI_LAB_OVERVIEW: Record<AiLabDomain, AiLabOverview> = {
  legal: {
    corporaTotal: 4,
    documentTotal: 186,
    activeSessions: 2,
    queuedSessions: 1,
    corpora: [
      { id: "statutes", name: "Statutes + annotations", documents: 64 },
      { id: "briefs", name: "Litigation briefs", documents: 42 },
      { id: "policies", name: "Compliance policies", documents: 30 },
    ],
  },
  academic: {
    corporaTotal: 3,
    documentTotal: 142,
    activeSessions: 1,
    queuedSessions: 2,
    corpora: [
      { id: "stem", name: "STEM research packets", documents: 48 },
      { id: "humanities", name: "Humanities essays", documents: 32 },
      { id: "coaching", name: "Learning playbooks", documents: 21 },
    ],
  },
};

const tierLabelMap: Record<TierId, string> = subscriptionTiers.reduce(
  (map, tier) => {
    map[tier.id] = tier.label;
    return map;
  },
  {} as Record<TierId, string>
);

function isLocked(activeTier: TierId, requiredTier: TierId) {
  return tierOrder.indexOf(activeTier) < tierOrder.indexOf(requiredTier);
}

async function fetchDashboardJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Dashboard request failed");
  }
  return (await response.json()) as T;
}

export default function AppDashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const isAdmin = Boolean(isSignedIn && !!user && isAdminFromMetadata(user.publicMetadata, email));
  const userTier = useMemo(
    () => deriveTierFromMetadata(user?.publicMetadata, { isAdmin }),
    [user?.publicMetadata, isAdmin]
  );
  const [tierPreview, setTierPreview] = useState<TierId | null>(null);
  const [mobileToolboxOpen, setMobileToolboxOpen] = useState(false);

  const userTierDetails = useMemo(
    () => subscriptionTiers.find((tier) => tier.id === userTier) ?? subscriptionTiers[0],
    [userTier]
  );
  const activeTier = tierPreview ?? userTier;
  const activeTierDetails = useMemo(
    () => subscriptionTiers.find((tier) => tier.id === activeTier) ?? subscriptionTiers[0],
    [activeTier]
  );
  const isPreviewing = tierPreview !== null;

  const annotatedLaunchers = useMemo<AnnotatedLauncher[]>(
    () =>
      toolLaunchers.map((tool) => {
        const tierUnlocked = !isLocked(userTier, tool.minTier);
        const previewTierUnlocked = !isLocked(activeTier, tool.minTier);
        const adminUnlocked = !tool.requiresAdmin || isAdmin;
        const hasAccess = Boolean(tierUnlocked && adminUnlocked);
        const previewHasAccess = Boolean(previewTierUnlocked && adminUnlocked);
        let badgeLabel: string;
        if (hasAccess) {
          badgeLabel = previewHasAccess ? "Included" : "Included · hidden in preview";
        } else if (previewHasAccess) {
          badgeLabel = `Preview · ${tierLabelMap[tool.minTier]}`;
        } else {
          badgeLabel = `Unlock with ${tierLabelMap[tool.minTier]}`;
        }
        return {
          ...tool,
          locked: !hasAccess,
          badgeLabel,
          hasAccess,
          previewHasAccess,
        };
      }),
    [activeTier, isAdmin, userTier]
  );

  if (!isLoaded) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Checking account access…
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Please sign in to access your CCPROS dashboard.
      </div>
    );
  }

  const preferredName =
    user.firstName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "crew member";

  const openMobileToolbox = () => setMobileToolboxOpen(true);
  const closeMobileToolbox = () => setMobileToolboxOpen(false);
  const resetTierPreview = () => setTierPreview(null);
  const handleTierSelect = (tierId: TierId) => {
    setTierPreview(tierId === userTier ? null : tierId);
  };

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      <div className="flex-1 space-y-10">
        <div className="flex justify-end lg:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={mobileToolboxOpen ? closeMobileToolbox : openMobileToolbox}
            aria-label={mobileToolboxOpen ? "Close toolbox" : "Open toolbox"}
          >
            {mobileToolboxOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-4xl border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background p-8 shadow-xl shadow-black/10">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tool cockpit</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {preferredName}.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Every workspace you have unlocked lives here. Plan your week, update health records, run
            academic cycles, manage legal matters, or train AI copilots—all from one dashboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/app/life-dashboard">
                Resume planner
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/app/health-dashboard">Check health studio</Link>
            </Button>
            <span className="inline-flex items-center rounded-full border border-border/70 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {userTierDetails.label} plan
            </span>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {signalCards.map((signal) => (
              <article
                key={signal.id}
                className="rounded-3xl border border-border/60 bg-card/70 p-4 text-sm shadow-lg shadow-black/5"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  <span>{signal.label}</span>
                </div>
                <p className="mt-3 text-lg font-semibold">{signal.metric}</p>
                <p className="text-muted-foreground">{signal.detail}</p>
                <p className="mt-2 text-xs text-primary">{signal.trend}</p>
              </article>
            ))}
          </div>
        </div>

        <aside
          id="subscriptions"
          className="rounded-4xl border border-border/70 bg-card/70 p-6 shadow-lg shadow-black/10"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Subscription</p>
          <h2 className="mt-3 text-2xl font-semibold">Choose your tier</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Switch tiers to preview which tools unlock. You are currently on the {userTierDetails.label} plan.
            Upgrades will flow through billing once authentication is live.
          </p>
          {isPreviewing ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-primary">
              <span className="uppercase tracking-[0.3em]">Previewing {activeTierDetails.label}</span>
              <button
                type="button"
                onClick={resetTierPreview}
                className="rounded-full border border-primary/40 px-3 py-1 font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-primary/10"
              >
                Return to my plan
              </button>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {subscriptionTiers.map((tier) => {
              const isCurrentPlan = tier.id === userTier;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => handleTierSelect(tier.id)}
                  className={cn(
                    "flex-1 rounded-2xl border px-4 py-3 text-left text-sm transition",
                    activeTier === tier.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:border-border",
                    isCurrentPlan && "ring-1 ring-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{tier.label}</span>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {tier.price}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{tier.tagline}</p>
                  {isCurrentPlan ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
                      <Check className="size-3" />
                      My plan
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-5 rounded-3xl border border-dashed border-border/70 bg-background/80 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {activeTierDetails.label} includes
            </p>
            <p className="mt-2 font-semibold">{activeTierDetails.description}</p>
            <ul className="mt-3 space-y-1 text-muted-foreground">
              {activeTierDetails.highlights.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Workspaces</p>
            <h2 className="text-2xl font-semibold">Your tool deck</h2>
            <p className="text-sm text-muted-foreground">
              {isPreviewing
                ? `Previewing the ${activeTierDetails.label} plan. Your membership: ${userTierDetails.label}.`
                : `Showing the tools included in your ${userTierDetails.label} plan.`}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-4 py-1 text-xs uppercase tracking-[0.3em]",
              isPreviewing ? "border-primary/60 text-primary" : "border-border/70 text-muted-foreground"
            )}
          >
            {isPreviewing
              ? `Preview · ${activeTierDetails.label}`
              : `My plan · ${userTierDetails.label}`}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {annotatedLaunchers.map((tool) => {
            const adminOnly = tool.requiresAdmin && !isAdmin;
            return (
              <article
                key={tool.id}
                className={cn(
                  "relative rounded-4xl border border-border/70 bg-card/70 p-5 shadow-lg shadow-black/5",
                  tool.locked && "opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {tool.pillar}
                    </p>
                  <h3 className="mt-2 text-xl font-semibold">{tool.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                    tool.locked ? "border-dashed text-muted-foreground" : "border-primary/40 text-primary"
                  )}
                >
                  {tool.locked ? <Lock className="size-3.5" /> : <Check className="size-3.5" />}
                  {tool.badgeLabel}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs uppercase tracking-[0.3em]">
                  {tool.status}
                </span>
                <span className="text-foreground">{tool.metricLabel}:</span>
                <span>{tool.metricValue}</span>
              </div>
              {isPreviewing && tool.hasAccess && !tool.previewHasAccess ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Hidden in this preview but still included in your {userTierDetails.label} plan.
                </p>
              ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {tool.hasAccess ? (
                    <Button size="sm" asChild>
                      <Link href={tool.href}>
                        Open workspace
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  ) : adminOnly ? (
                    <Button variant="outline" size="sm" disabled>
                      Admin access required
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <a href="#subscriptions">
                        Upgrade for {tierLabelMap[tool.minTier]}
                        <ArrowRight className="size-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={!tool.hasAccess}>
                    View rituals
                  </Button>
                </div>
                {!tool.hasAccess ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {adminOnly
                      ? "Only CCPROS admins can access this workspace."
                      : `Upgrade to the ${tierLabelMap[tool.minTier]} plan to activate this workspace.`}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <AiLabConsole />
      </section>

      <section>
        <ResearchWritingConsole isLoaded={isLoaded} isSignedIn={isSignedIn} />
      </section>

      <section>
        <LegalProjectsConsole isLoaded={isLoaded} isSignedIn={isSignedIn} />
      </section>

      <section>
        <AdminWorkbenchPreview isAdmin={isAdmin} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <div className="rounded-4xl border border-border/70 bg-card/70 p-6 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Ritual queue</p>
              <h2 className="mt-1 text-2xl font-semibold">Next best actions</h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/life-dashboard">
                Sync planner
                <CalendarClock className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            {ritualQueue.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-border/60 bg-background/80 p-4 text-sm shadow-inner shadow-black/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {item.relatedTool}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={item.href}>
                      {item.actionLabel}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                <p className="mt-2 text-muted-foreground">{item.summary}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-4xl border border-border/70 bg-card/70 p-5 shadow-lg shadow-black/5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <Activity className="size-4" />
              <span>Ops telemetry</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold">Systems pulse</h3>
            <p className="text-sm text-muted-foreground">
              Planner + Health insights inform Academics, Legal, and AI Lab readiness.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <Target className="mt-0.5 size-4 text-primary" />
                <span>
                  <strong className="text-foreground">Focus:</strong> next sprint locked, 1 risk flagged
                  (legal matter sync).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <LineChart className="mt-0.5 size-4 text-primary" />
                <span>
                  <strong className="text-foreground">Health:</strong> per-person budget tracking +$45 vs
                  plan; cadence needs new entry.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-4 text-primary" />
                <span>
                  <strong className="text-foreground">AI Lab:</strong> retraining session awaiting QA
                  before deploy.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-4xl border border-dashed border-border/70 bg-muted/30 p-5 text-sm text-muted-foreground">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">What&rsquo;s next</p>
            <p className="mt-2 text-foreground">
              Once authentication toggles on, signed-in users will land here after login and keep
              moving without re-orienting. Admin-only surfaces (Code Manager, advanced AI tools) stay
              hidden unless the account metadata marks them as admin.
            </p>
          </div>
        </div>
      </section>
    </div>

    <div className="hidden lg:block lg:w-[320px] xl:w-[360px]">
      <aside className="sticky top-24">
        <div className="rounded-4xl border border-border/70 bg-card/80 p-5 shadow-2xl shadow-black/15 ring-1 ring-border/60">
          <ToolboxPanel tierLabel={userTierDetails.label} />
        </div>
      </aside>
    </div>

    {mobileToolboxOpen ? (
      <div className="lg:hidden fixed inset-0 z-40">
        <button
          type="button"
          onClick={closeMobileToolbox}
          className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          aria-label="Close toolbox overlay"
        />
        <div className="absolute inset-y-6 left-4 right-4">
          <div className="h-full max-h-[calc(100vh-3rem)] overflow-y-auto rounded-4xl border border-border/70 bg-card/95 p-5 shadow-2xl shadow-black/30">
            <ToolboxPanel tierLabel={userTierDetails.label} showClose onClose={closeMobileToolbox} />
          </div>
        </div>
      </div>
    ) : null}
  </div>
);
}

type ToolboxPanelProps = {
  tierLabel: string;
  showClose?: boolean;
  onClose?: () => void;
};

function AiLabConsole() {
  const [domain, setDomain] = useState<AiLabDomain>("legal");
  const summary = AI_LAB_OVERVIEW[domain];

  return (
    <div className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI Lab</p>
          <h2 className="text-2xl font-semibold">Creator copilot console</h2>
          <p className="text-sm text-muted-foreground">
            Track corpus health, recent sessions, and domain focus directly from the dashboard.
          </p>
        </div>
        <div className="flex gap-2">
          {(["legal", "academic"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDomain(option)}
              className={cn(
                "rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]",
                domain === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Corpora</p>
          <p className="mt-2 text-2xl font-semibold">{summary.corporaTotal}</p>
          <p className="text-xs text-muted-foreground">Active datasets</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Documents</p>
          <p className="mt-2 text-2xl font-semibold">{summary.documentTotal}</p>
          <p className="text-xs text-muted-foreground">Processed entries</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Active sessions</p>
          <p className="mt-2 text-2xl font-semibold">{summary.activeSessions}</p>
          <p className="text-xs text-muted-foreground">Running or reviewing</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Queued</p>
          <p className="mt-2 text-2xl font-semibold">{summary.queuedSessions}</p>
          <p className="text-xs text-muted-foreground">Draft or queued sessions</p>
        </div>
      </div>
      <div className="mt-5 rounded-3xl border border-dashed border-border/70 bg-background/90 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Corpora preview</p>
        {summary.corpora.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {summary.corpora.map((corpus) => (
              <li
                key={corpus.id}
                className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/70 px-3 py-2"
              >
                <span>{corpus.name}</span>
                <span className="text-xs text-muted-foreground">{corpus.documents} docs</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No corpora detected for this domain yet. Add a dataset in the full AI Lab.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button size="sm" asChild>
          <Link href="/app/ai-training">Open full AI Lab</Link>
        </Button>
        <Button variant="outline" size="sm">
          Plan automations
        </Button>
      </div>
    </div>
  );
}

function ResearchWritingConsole({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
}) {
  const [view, setView] = useState<"research" | "writing">("research");
  const [tracks, setTracks] = useState<ResearchTrackSummary[]>([]);
  const [drafts, setDrafts] = useState<WritingDraftSummary[]>([]);
  const [sources, setSources] = useState<ResearchSourceSummary[]>([]);
  const [projects, setProjects] = useState<AcademicProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tracksData, draftsData, sourcesData, projectsData] = await Promise.all([
          fetchDashboardJson<{ tracks: ResearchTrackSummary[] }>("/api/academics/tracks", {
            signal: controller.signal,
          }),
          fetchDashboardJson<{ drafts: WritingDraftSummary[] }>("/api/academics/drafts", {
            signal: controller.signal,
          }),
          fetchDashboardJson<{ sources: ResearchSourceSummary[] }>("/api/academics/sources", {
            signal: controller.signal,
          }),
          fetchDashboardJson<{ projects: AcademicProjectSummary[] }>("/api/academic-projects", {
            signal: controller.signal,
          }),
        ]);
        if (!isMounted) {
          return;
        }
        setTracks(tracksData.tracks);
        setDrafts(draftsData.drafts);
        setSources(sourcesData.sources);
        setProjects(projectsData.projects);
      } catch (err) {
        if (!isMounted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load research cockpit data.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isLoaded, isSignedIn]);

  const [now] = useState(() => Date.now());
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const researchRunsThisWeek = projects.filter((project) => {
    const updated = project.updated_at ?? project.created_at;
    if (!updated) return false;
    return new Date(updated).getTime() >= weekAgo;
  }).length;
  const mentorSyncLabel = tracks[0]?.timeframe || "Schedule review";
  const draftsInProgress = drafts.length;
  const readingQueue = sources.length;

  const trackList = tracks.slice(0, 3);
  const draftList = drafts.slice(0, 3);
  const readingList = sources.slice(0, 3);

  return (
    <div className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Learning</p>
          <h2 className="text-2xl font-semibold">Research + writing cockpit</h2>
          <p className="text-sm text-muted-foreground">
            Map study tracks, capture AI research, and move drafts forward together.
          </p>
        </div>
        <div className="flex gap-2">
          {(["research", "writing"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={cn(
                "rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]",
                view === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-3xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Runs</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : researchRunsThisWeek}</p>
          <p className="text-xs text-muted-foreground">This week</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Drafts</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : draftsInProgress}</p>
          <p className="text-xs text-muted-foreground">In progress</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Reading queue</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : readingQueue}</p>
          <p className="text-xs text-muted-foreground">Sources flagged</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Mentor sync</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : mentorSyncLabel}</p>
          <p className="text-xs text-muted-foreground">Next review</p>
        </div>
      </div>

      {view === "research" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <div className="rounded-3xl border border-border/70 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tracks</p>
            {loading && trackList.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading tracks…</p>
            ) : trackList.length > 0 ? (
              <ul className="mt-3 space-y-3 text-sm">
                {trackList.map((track) => (
                  <li
                    key={track.id}
                    className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{track.topic}</p>
                      <span className="text-xs text-muted-foreground">{track.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {track.question || "No question logged"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Timeframe: {track.timeframe}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No research tracks yet. Use Academic Studio to add one.
              </p>
            )}
          </div>
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Reading stack</p>
            {loading && readingList.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading reading list…</p>
            ) : readingList.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {readingList.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-border/60 px-3 py-2">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs">{item.type}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Add sources in Academic Studio to track your reading queue here.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <div className="rounded-3xl border border-border/70 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Drafts</p>
            {loading && draftList.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading drafts…</p>
            ) : draftList.length > 0 ? (
              <ul className="mt-3 space-y-3 text-sm">
                {draftList.map((draft) => (
                  <li
                    key={draft.id}
                    className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2"
                  >
                    <p className="font-semibold">{draft.title}</p>
                    <p className="text-xs text-muted-foreground">{draft.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {draft.focus || "Add focus notes"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No drafts yet. Start writing from Academic Studio.
              </p>
            )}
          </div>
          <div className="rounded-3xl border border-dashed border-border/70 bg-background/90 p-4 space-y-3 text-sm text-muted-foreground">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Writing rituals</p>
            <p>Pair AI research output with daily writing blocks and mentor check-ins.</p>
            <Button size="sm" asChild>
              <Link href="/app/academics">Open research cockpit</Link>
            </Button>
            <Button variant="outline" size="sm">
              Plan study sprint
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegalProjectsConsole({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
}) {
  const [projects, setProjects] = useState<LegalProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    let isMounted = true;
    const controller = new AbortController();

    const loadProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchDashboardJson<{ projects: LegalProjectSummary[] }>(
          "/api/legal-projects",
          { signal: controller.signal }
        );
        if (!isMounted) return;
        setProjects(payload.projects ?? []);
      } catch (err) {
        if (!isMounted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load legal projects.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isLoaded, isSignedIn]);

  const recentProjects = projects.slice(0, 3);
  const activeSessions = projects.filter((project) => project.session_id).length;
  const idleProjects = projects.length - activeSessions;

  return (
    <div className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Legal</p>
          <h2 className="text-2xl font-semibold">Legal projects cockpit</h2>
          <p className="text-sm text-muted-foreground">
            Summaries of active matters, research briefs, and GPT-5 sessions live here.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/legal-projects">Open legal workspace</Link>
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-3xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Projects</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : projects.length}</p>
          <p className="text-xs text-muted-foreground">Total tracked</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Active sessions</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : activeSessions}</p>
          <p className="text-xs text-muted-foreground">Running or reviewing</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Needs research</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "…" : idleProjects}</p>
          <p className="text-xs text-muted-foreground">Awaiting answers</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Latest update</p>
          <p className="mt-2 text-2xl font-semibold">
            {loading ? "…" : recentProjects[0]?.title ?? "No projects"}
          </p>
          <p className="text-xs text-muted-foreground">Most recent brief</p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border/70 bg-background/90 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Recent projects</p>
        {loading && recentProjects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading legal matters…</p>
        ) : recentProjects.length > 0 ? (
          <ul className="mt-3 space-y-3 text-sm">
            {recentProjects.map((project) => (
              <li
                key={project.id}
                className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{project.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {project.question || "Question pending"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {project.session_id ? "Session active" : "Ready for research"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No legal projects yet. Use the workspace to start one.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button size="sm" asChild>
          <Link href="/app/legal-projects">Launch brief builder</Link>
        </Button>
        <Button variant="outline" size="sm">
          Plan compliance check-in
        </Button>
      </div>
    </div>
  );
}

function AdminWorkbenchPreview({ isAdmin }: { isAdmin: boolean }) {
  const activity = [
    {
      id: "assistant",
      title: "Assistant console",
      detail: "2 replies waiting for operator review",
    },
    {
      id: "repo",
      title: "Repo explorer",
      detail: "main branch clean · 1 draft change",
    },
    {
      id: "policy",
      title: "Policy updates",
      detail: "Onboarding checklist refresh due Friday",
    },
  ];

  return (
    <div className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin</p>
          <h2 className="text-2xl font-semibold">Operations workbench</h2>
          <p className="text-sm text-muted-foreground">
            Manage code, assistant knowledge, and internal rituals without leaving this dashboard.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/admin">Open admin</Link>
        </Button>
      </div>

      {isAdmin ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Code queue</p>
              <p className="mt-2 text-2xl font-semibold">1 patch</p>
              <p className="text-xs text-muted-foreground">Awaiting merge</p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Knowledge chats</p>
              <p className="mt-2 text-2xl font-semibold">2 threads</p>
              <p className="text-xs text-muted-foreground">Follow-up today</p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Policy status</p>
              <p className="mt-2 text-2xl font-semibold">On track</p>
              <p className="text-xs text-muted-foreground">Next review Fri</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr,1fr]">
            <div className="rounded-3xl border border-border/70 bg-background/90 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Activity</p>
              <ul className="mt-3 space-y-3 text-sm">
                {activity.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2"
                  >
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-dashed border-border/70 bg-background/90 p-4 space-y-3 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Actions</p>
              <p>Use the Admin Workbench to collaborate with Codex, review patches, or update runbooks.</p>
              <div className="flex flex-col gap-2">
                <Button size="sm" asChild>
                  <Link href="/app/admin">Launch workbench</Link>
                </Button>
                <Button variant="outline" size="sm">
                  Export weekly digest
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-border/70 bg-background/90 p-4 text-sm text-muted-foreground">
          <p className="text-xs uppercase tracking-[0.3em]">Restricted</p>
          <p className="mt-2">
            Admin tools are limited to CCPROS operators. Contact the team if you need access for code
            management or institutional research.
          </p>
        </div>
      )}
    </div>
  );
}

function ToolboxPanel({ tierLabel, showClose, onClose }: ToolboxPanelProps) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    toolboxCategories[0]?.id ?? "arts-and-crafts"
  );
  const activeCategory =
    toolboxCategories.find((category) => category.id === activeCategoryId) ?? toolboxCategories[0];
  const hasTools = (activeCategory.tools?.length ?? 0) > 0;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Toolbox</p>
          <h3 className="text-xl font-semibold">Mini-app console</h3>
          <p className="text-xs text-muted-foreground">Docked to your {tierLabel} tier.</p>
        </div>
        {showClose ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close toolbox panel"
            className="text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {toolboxCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategoryId(category.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
              activeCategoryId === category.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/70 text-muted-foreground hover:border-border"
            )}
          >
            {category.label}
          </button>
        ))}
      </div>
      {hasTools ? (
        <div className="space-y-3">
          {activeCategory.tools!.map((tool) => (
            <article
              key={tool.id}
              className="space-y-3 rounded-3xl border border-border/70 bg-background/80 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {activeCategory.label}
                  </p>
                  <h4 className="text-lg font-semibold">{tool.title}</h4>
                </div>
                <span className="rounded-full border border-border/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {tool.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
              <p className="text-xs text-muted-foreground">{tool.hint}</p>
              <Button size="sm" asChild>
                <Link href={tool.href}>{tool.actionLabel}</Link>
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border border-dashed border-border/80 bg-background/80 p-4 text-sm text-muted-foreground">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {activeCategory.label}
          </p>
          <p>{activeCategory.description}</p>
          <p className="rounded-2xl border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
            {activeCategory.placeholder}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center text-xs uppercase tracking-[0.3em]"
          >
            Plan tools
          </Button>
        </div>
      )}
    </div>
  );
}
