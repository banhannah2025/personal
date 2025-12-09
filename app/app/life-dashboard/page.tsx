"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type TimeframeCard = {
  timeframe: string;
  highlight: string;
  goals: string[];
  metric: string;
};

type CalendarEntry = {
  id: number;
  time: string;
  label: string;
  location?: string;
};

type CalendarDay = {
  id: number;
  day: string;
  dateLabel: string;
  focus: string;
  entries: CalendarEntry[];
};

type Note = {
  id: number;
  title: string;
  content: string;
  tag: string;
  createdAt: string;
};

type JournalEntry = {
  id: number;
  mood: string;
  reflection: string;
  createdAt: string;
};

const timeframeBlueprint: TimeframeCard[] = [
  {
    timeframe: "Daily Momentum",
    highlight: "Protect energy anchors + top 3 deliverables.",
    goals: [
      "Deep-focus block",
      "Mobility + meal plan",
      "Community touchpoint",
    ],
    metric: "3 focus blocks reserved",
  },
  {
    timeframe: "Weekly Sprint",
    highlight: "Ship meaningful work and reflect every Friday.",
    goals: ["Prototype AI workflow", "Long-run + journaling", "Finance review"],
    metric: "70% of sprint mapped",
  },
  {
    timeframe: "Monthly Vision",
    highlight: "Document experiments + track resources.",
    goals: ["4 learning blocks", "Update personal KPIs", "Health lab results"],
    metric: "4 / 6 habits on track",
  },
  {
    timeframe: "Annual Compass",
    highlight: "Align skills, wellness, and location independence.",
    goals: ["Plan sabbatical", "Deepen AI research", "Upgrade navigation stack"],
    metric: "Q2 review scheduled",
  },
];

const calendarWeek: CalendarDay[] = [
  {
    id: 1,
    day: "Mon",
    dateLabel: "Apr 1",
    focus: "Deep Work",
    entries: [
      { id: 1, time: "08:00", label: "Sunrise run", location: "River Trail" },
      { id: 2, time: "10:00", label: "AI sprint planning", location: "Studio" },
      { id: 3, time: "18:00", label: "Journal + stretch" },
    ],
  },
  {
    id: 2,
    day: "Tue",
    dateLabel: "Apr 2",
    focus: "Collaboration",
    entries: [
      { id: 4, time: "09:00", label: "Mentor sync", location: "Civic Hub" },
      { id: 5, time: "14:30", label: "Notebook review" },
    ],
  },
  {
    id: 3,
    day: "Wed",
    dateLabel: "Apr 3",
    focus: "Mobility",
    entries: [
      { id: 6, time: "07:30", label: "Bike to cowork", location: "Canal Route" },
      { id: 7, time: "16:00", label: "Design notebook update" },
    ],
  },
  {
    id: 4,
    day: "Thu",
    dateLabel: "Apr 4",
    focus: "Learning",
    entries: [
      { id: 8, time: "10:00", label: "AI research block" },
      { id: 9, time: "19:00", label: "Night walk + podcast", location: "Old Town" },
    ],
  },
  {
    id: 5,
    day: "Fri",
    dateLabel: "Apr 5",
    focus: "Reflection",
    entries: [
      { id: 10, time: "11:00", label: "Weekly review" },
      { id: 11, time: "17:30", label: "Deep rest setup" },
    ],
  },
  {
    id: 6,
    day: "Sat",
    dateLabel: "Apr 6",
    focus: "Adventure",
    entries: [
      { id: 12, time: "09:30", label: "Trail notebook", location: "Granite Ridge" },
      { id: 13, time: "13:00", label: "Journal picnic" },
    ],
  },
  {
    id: 7,
    day: "Sun",
    dateLabel: "Apr 7",
    focus: "Reset",
    entries: [
      { id: 14, time: "08:30", label: "Plan next sprint" },
      { id: 15, time: "19:00", label: "Notebook archive" },
    ],
  },
];

const journalMoods = ["Energized", "Focused", "Grateful", "Stretched", "Calm"] as const;

export default function LifeDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [notes, setNotes] = useState<Note[]>([
    {
      id: 1,
      title: "Home base reset",
      content: "Declutter studio, prep healthy meals, refresh task board.",
      tag: "Wellness",
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: "AI research prompts",
      content: "Map daily insights so the assistant can draft briefs and itineraries.",
      tag: "Strategy",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
    tag: "Planning",
  });

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([
    {
      id: 1,
      mood: "Focused",
      reflection: "Morning ride improved clarity. Pair coding sessions with outdoor time.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [journalForm, setJournalForm] = useState({
    mood: journalMoods[0],
    reflection: "",
  });

  const [aiSummary, setAiSummary] = useState(
    "AI will summarize your planning rhythm once you add a note or journal entry."
  );
  const [aiPrompts, setAiPrompts] = useState<
    Array<{ title: string; detail: string }>
  >([
    {
      title: "Log insights",
      detail: "Capture a note or journal reflection so the planner AI can tailor prompts.",
    },
    {
      title: "Share context",
      detail: "Tell the assistant your weekly focus to keep reminders aligned with real goals.",
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  type PlannerAiOverride = {
    notes?: Note[];
    journalEntries?: JournalEntry[];
  };

  const refreshPlannerInsights = useCallback(
    async (override?: PlannerAiOverride) => {
      if (!isSignedIn) return;
      setAiLoading(true);
      setAiError(null);
      const effectiveNotes = override?.notes ?? notes;
      const effectiveJournal = override?.journalEntries ?? journalEntries;
      try {
        const response = await fetch("/api/planner-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: effectiveNotes.map((note) => ({
              title: note.title,
              content: note.content,
              tag: note.tag,
            })),
            journals: effectiveJournal.map((entry) => ({
              mood: entry.mood,
              reflection: entry.reflection,
              createdAt: entry.createdAt,
            })),
            weeklyFocus: calendarWeek.map((day) => ({
              day: day.day,
              focus: day.focus,
            })),
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Unable to fetch planner insights");
        }
        const data = (await response.json()) as {
          summary: string;
          prompts: Array<{ title: string; detail: string }>;
        };
        setAiSummary(data.summary);
        setAiPrompts(data.prompts);
      } catch (error) {
        console.error(error);
        setAiError(error instanceof Error ? error.message : "Failed to refresh AI prompts");
      } finally {
        setAiLoading(false);
      }
    },
    [isSignedIn, notes, journalEntries]
  );

  const plannerInsightsLoaded = useRef(false);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || plannerInsightsLoaded.current) {
      return;
    }
    plannerInsightsLoaded.current = true;
    void refreshPlannerInsights();
  }, [isLoaded, isSignedIn, refreshPlannerInsights]);

  const handleAddNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteForm.title.trim() || !noteForm.content.trim()) {
      return;
    }
    const newNote: Note = {
      id: Date.now(),
      title: noteForm.title.trim(),
      content: noteForm.content.trim(),
      tag: noteForm.tag.trim() || "General",
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    void refreshPlannerInsights({ notes: updatedNotes });
    setNoteForm({ title: "", content: "", tag: noteForm.tag });
  };

  const handleAddJournalEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!journalForm.reflection.trim()) {
      return;
    }
    const newEntry: JournalEntry = {
      id: Date.now(),
      mood: journalForm.mood,
      reflection: journalForm.reflection.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedEntries = [newEntry, ...journalEntries];
    setJournalEntries(updatedEntries);
    void refreshPlannerInsights({ journalEntries: updatedEntries });
    setJournalForm((prev) => ({ ...prev, reflection: "" }));
  };

  if (!isLoaded) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 p-8 text-center text-sm text-muted-foreground">
        Checking authentication…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/70 p-8 text-center text-sm text-muted-foreground">
        Please sign in to access the Planner dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Life Systems
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Calendar, notebook, and journal intelligence
        </h1>
        <p className="text-muted-foreground">
          A shared cockpit for you and the assistant to orchestrate daily, weekly, monthly,
          and yearly intentions—focused on reflective data instead of location services.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {timeframeBlueprint.map((frame) => (
          <article
            key={frame.timeframe}
            className="rounded-3xl border border-border/80 bg-card/70 p-5 shadow-lg shadow-black/5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary">
              {frame.timeframe}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{frame.highlight}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {frame.goals.map((goal) => (
                <li key={goal} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {goal}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">{frame.metric}</p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Calendar & Rhythm Map</h2>
            <p className="text-muted-foreground">
              Track the next seven days with context-aware focus blocks.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Daily → Yearly Continuity
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {calendarWeek.map((day) => (
            <div
              key={day.id}
              className="rounded-2xl border border-border/70 bg-muted/10 p-4"
            >
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold">{day.day}</p>
                  <p className="text-muted-foreground">{day.dateLabel}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {day.focus}
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {day.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-border/40 bg-background/70 p-3"
                  >
                    <p className="font-medium">{entry.time}</p>
                    <p className="text-muted-foreground">{entry.label}</p>
                    {entry.location && (
                      <p className="text-xs text-primary">{entry.location}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Notebook Workspace</h2>
          <p className="text-sm text-muted-foreground">
            Capture structured notes the assistant can remix into plans, prompts, or checklists.
          </p>
          <form onSubmit={handleAddNote} className="mt-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Title
              </label>
              <input
                value={noteForm.title}
                onChange={(event) =>
                  setNoteForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="e.g. Q2 deep-work recipes"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Tag
              </label>
              <input
                value={noteForm.tag}
                onChange={(event) =>
                  setNoteForm((prev) => ({ ...prev, tag: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Planning / Wellness / Work"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Content
              </label>
              <textarea
                value={noteForm.content}
                onChange={(event) =>
                  setNoteForm((prev) => ({ ...prev, content: event.target.value }))
                }
                className="min-h-[120px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Add ingredients, steps, or AI instructions..."
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Save note
            </button>
          </form>
          <div className="mt-6 space-y-4">
            {notes.map((note) => (
              <article
                key={note.id}
                className="rounded-2xl border border-border/30 bg-background/60 p-4"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-[0.2em]">{note.tag}</span>
                  <span>
                    {new Date(note.createdAt).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold">{note.title}</h3>
                <p className="text-sm text-muted-foreground">{note.content}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Journal Stream</h2>
          <p className="text-sm text-muted-foreground">
            Log reflections so AI can cross-reference mood and tasks.
          </p>
          <form onSubmit={handleAddJournalEntry} className="mt-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Mood
              </label>
              <select
                value={journalForm.mood}
                onChange={(event) =>
                  setJournalForm((prev) => ({ ...prev, mood: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {journalMoods.map((mood) => (
                  <option key={mood} value={mood}>
                    {mood}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Reflection
              </label>
              <textarea
                value={journalForm.reflection}
                onChange={(event) =>
                  setJournalForm((prev) => ({ ...prev, reflection: event.target.value }))
                }
                className="min-h-[120px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="What shifted today? What needs attention tomorrow?"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Log entry
            </button>
          </form>
          <div className="mt-6 space-y-4">
            {journalEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-border/30 bg-background/60 p-4"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-[0.2em]">{entry.mood}</span>
                  <span>
                    {new Date(entry.createdAt).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {entry.reflection}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5 lg:col-span-2">
          <h2 className="text-2xl font-semibold">Focus Alignment Canvas</h2>
          <p className="text-sm text-muted-foreground">
            Pair notebook, journal, and calendar data to design experiments, prompts, or goals.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Latest note insight
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {notes.at(-1)?.content ?? "Capture a note to unlock AI context."}
              </p>
            </article>
            <article className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Current journal mood
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {journalEntries[0]?.mood ?? "Log a journal entry to sync mood."}
              </p>
            </article>
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
            Future idea: connect to external knowledge bases (Notion, Obsidian, open calendars)
            so AI can synthesize action plans without location data.
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">AI Sync Panel</h2>
          <p className="text-sm text-muted-foreground">{aiSummary}</p>
          <div className="mt-4 flex items-center gap-3">
            {aiError ? <p className="text-xs text-destructive">{aiError}</p> : null}
            <button
              type="button"
              onClick={() => refreshPlannerInsights()}
              disabled={aiLoading}
              className="rounded-full border border-primary/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {aiLoading ? "Updating…" : "Refresh AI"}
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {aiPrompts.map((idea) => (
              <article
                key={idea.title}
                className="rounded-2xl border border-border/40 bg-background/70 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {idea.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{idea.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
            AI recommendations update every time you log notes or journal entries—share them with the
            assistant for calendar reminders.
          </div>
        </div>
      </section>
    </div>
  );
}
