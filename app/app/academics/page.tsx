"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type ResearchTrack = {
  id: string;
  topic: string;
  question: string;
  timeframe: string;
  status: string;
  created_at: string;
};

type SourceRecord = {
  id: string;
  title: string;
  type: string;
  link: string;
  reliability: "Key" | "Support" | "Review";
  created_at: string;
};

type WritingDraft = {
  id: string;
  title: string;
  focus: string;
  status: "Notes" | "Outline" | "Drafting" | "Editing";
  summary: string;
  created_at: string;
};

type StudyTask = {
  id: string;
  label: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  created_at: string;
};

type PlanOption = {
  id: string;
  cadence: "Weekly" | "Monthly";
  title: string;
  summary: string;
  actions: string[];
};

type AcademicCitation = {
  source: string;
  document_id: string;
  title: string;
  excerpt: string;
};

type AcademicProject = {
  id: string;
  title: string;
  question: string;
  instructions: string;
  discipline: string;
  last_answer: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

const DISCIPLINES = [
  "Interdisciplinary",
  "STEM",
  "Humanities",
  "Social Sciences",
  "Business",
  "Education",
  "Health Sciences",
  "Law & Policy",
  "Creative Arts",
  "Other",
] as const;

type DisciplineOption = (typeof DISCIPLINES)[number];

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Request failed");
  }
  return (await response.json()) as T;
}

export default function AcademicsDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [tracks, setTracks] = useState<ResearchTrack[]>([]);
  const [trackForm, setTrackForm] = useState({
    topic: "",
    question: "",
    timeframe: "",
    status: "Exploratory",
  });

  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [sourceForm, setSourceForm] = useState({
    title: "",
    type: "Article",
    link: "",
    reliability: "Support" as SourceRecord["reliability"],
  });

  const [drafts, setDrafts] = useState<WritingDraft[]>([]);
  const [draftForm, setDraftForm] = useState({
    title: "",
    focus: "",
    status: "Notes" as WritingDraft["status"],
    summary: "",
  });

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [taskForm, setTaskForm] = useState({
    label: "",
    due: "",
    priority: "Medium" as StudyTask["priority"],
  });
  const [academicProjects, setAcademicProjects] = useState<AcademicProject[]>([]);
  const [academicProjectsLoading, setAcademicProjectsLoading] = useState(false);
  const [academicProjectError, setAcademicProjectError] = useState<string | null>(null);
  const [researchTitle, setResearchTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [researchInstructions, setResearchInstructions] = useState("");
  const [researchAnswer, setResearchAnswer] = useState("");
  const [researchCitations, setResearchCitations] = useState<AcademicCitation[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [savingAcademicProject, setSavingAcademicProject] = useState(false);
  const [sessionCreateState, setSessionCreateState] = useState<Record<string, boolean>>({});
  const [researchDiscipline, setResearchDiscipline] = useState<DisciplineOption>("Interdisciplinary");
  const [projectDisciplineFilter, setProjectDisciplineFilter] = useState<DisciplineOption | "All">("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const loadAll = async () => {
      try {
        const [tracksData, sourcesData, draftsData, tasksData] = await Promise.all([
          fetchJson<{ tracks: ResearchTrack[] }>("/api/academics/tracks"),
          fetchJson<{ sources: SourceRecord[] }>("/api/academics/sources"),
          fetchJson<{ drafts: WritingDraft[] }>("/api/academics/drafts"),
          fetchJson<{ tasks: StudyTask[] }>("/api/academics/tasks"),
        ]);
        setTracks(tracksData.tracks);
        setSources(sourcesData.sources);
        setDrafts(draftsData.drafts);
        setTasks(tasksData.tasks);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load academics data");
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const loadAcademicProjects = async () => {
      setAcademicProjectsLoading(true);
      setAcademicProjectError(null);
      try {
        const response = await fetch("/api/academic-projects");
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Failed to load projects");
        }
        const body = (await response.json()) as { projects: AcademicProject[] };
        setAcademicProjects(body.projects);
      } catch (err) {
        console.error(err);
        setAcademicProjectError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setAcademicProjectsLoading(false);
      }
    };
    loadAcademicProjects();
  }, [isLoaded, isSignedIn]);

  const handleAddTrack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackForm.topic.trim()) {
      return;
    }
    try {
      const { track } = await fetchJson<{ track: ResearchTrack }>("/api/academics/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trackForm),
      });
      setTracks((prev) => [track, ...prev]);
      setTrackForm({ topic: "", question: "", timeframe: "", status: trackForm.status });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to add research track");
    }
  };

  const handleAddSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sourceForm.title.trim()) {
      return;
    }
    try {
      const { source } = await fetchJson<{ source: SourceRecord }>("/api/academics/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceForm),
      });
      setSources((prev) => [source, ...prev]);
      setSourceForm({ title: "", type: sourceForm.type, link: "", reliability: sourceForm.reliability });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save source");
    }
  };

  const handleAddDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftForm.title.trim()) {
      return;
    }
    try {
      const { draft } = await fetchJson<{ draft: WritingDraft }>("/api/academics/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftForm),
      });
      setDrafts((prev) => [draft, ...prev]);
      setDraftForm({ title: "", focus: "", status: draftForm.status, summary: "" });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save draft");
    }
  };

  const handleAddTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskForm.label.trim()) {
      return;
    }
    try {
      const { task } = await fetchJson<{ task: StudyTask }>("/api/academics/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskForm),
      });
      setTasks((prev) => [task, ...prev]);
      setTaskForm({ label: "", due: "", priority: taskForm.priority });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to save task");
    }
  };

  const refreshAcademicProjects = async () => {
    try {
      const response = await fetch("/api/academic-projects");
      if (!response.ok) {
        throw new Error("Failed to load projects");
      }
      const body = (await response.json()) as { projects: AcademicProject[] };
      setAcademicProjects(body.projects);
    } catch (err) {
      console.error(err);
      setAcademicProjectError(err instanceof Error ? err.message : "Failed to load projects");
    }
  };

  const handleAcademicResearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!researchTitle.trim() || !researchQuestion.trim()) {
      setAcademicProjectError("Provide a title and question for this research run.");
      return;
    }
    setAcademicProjectError(null);
    setResearchLoading(true);
    setResearchAnswer("");
    setResearchCitations([]);
    try {
      const response = await fetch("/api/academic-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: researchQuestion,
          instructions: researchInstructions,
          discipline: researchDiscipline,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Academic research failed");
      }
      const body = (await response.json()) as { answer: string; citations: AcademicCitation[] };
      setResearchAnswer(body.answer);
      setResearchCitations(body.citations);
    } catch (err) {
      console.error(err);
      setAcademicProjectError(err instanceof Error ? err.message : "Academic research failed");
    } finally {
      setResearchLoading(false);
    }
  };

  const handleSaveAcademicProject = async () => {
    if (!researchAnswer.trim()) {
      setAcademicProjectError("Run a research query before saving.");
      return;
    }
    setSavingAcademicProject(true);
    setAcademicProjectError(null);
    try {
      const response = await fetch("/api/academic-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: researchTitle,
          question: researchQuestion,
          instructions: researchInstructions,
          discipline: researchDiscipline,
          answer: researchAnswer,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to save project");
      }
      await refreshAcademicProjects();
    } catch (err) {
      console.error(err);
      setAcademicProjectError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSavingAcademicProject(false);
    }
  };

  const handleCreateAcademicSession = async (projectId: string) => {
    setSessionCreateState((prev) => ({ ...prev, [projectId]: true }));
    setAcademicProjectError(null);
    try {
      const response = await fetch(`/api/academic-projects/${projectId}/session`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to create training session");
      }
      await refreshAcademicProjects();
    } catch (err) {
      console.error(err);
      setAcademicProjectError(err instanceof Error ? err.message : "Failed to create training session");
    } finally {
      setSessionCreateState((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  const planOptions: PlanOption[] = (() => {
    const latestTrack = tracks[0];
    const latestDraft = drafts[0];
    const currentConcern = drafts[0]?.summary || sources[0]?.title || "Add research context";
    const perTrackSummary = latestTrack?.question || "Document your guiding questions";
    return [
      {
        id: "weekly-ritual",
        cadence: "Weekly",
        title: "Weekly synthesis sprint",
        summary: `Pair ${latestTrack?.topic ?? "new research"} with draft ${latestDraft?.title ?? "Untitled"} to produce shareable findings.`,
        actions: [
          "Sync Planner calendar with top study tasks",
          "Use AI to summarize the latest sources and append to drafts",
          "Review reliability tags and mark which citations need verification",
        ],
      },
      {
        id: "monthly-reset",
        cadence: "Monthly",
        title: "Monthly research retrospective",
        summary: `${perTrackSummary}. Highlight blockers like "${currentConcern}" to ask AI for better datasets or mentors.`,
        actions: [
          "Export draft history for archival",
          "Refine research questions + KPIs",
          "Schedule writing sprints via Planner reminders",
        ],
      },
    ];
  })();

  const filteredAcademicProjects = academicProjects.filter((project) => {
    if (projectDisciplineFilter === "All") return true;
    return (project.discipline || "Interdisciplinary") === projectDisciplineFilter;
  });

  if (!isLoaded) {
    return <p className="text-sm text-muted-foreground">Checking authentication…</p>;
  }
  if (!isSignedIn) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Please sign in to access the Academics dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Academics</p>
        <h1 className="text-4xl font-semibold tracking-tight">Research + writing cockpit</h1>
        <p className="text-muted-foreground">
          Map studies, collect sources, and advance drafts. Entries persist in Supabase so AI can
          learn from every iteration.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading workspace…</p> : null}
      </header>

      <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-3">
            <h2 className="text-2xl font-semibold">Academic AI research</h2>
            <p className="text-sm text-muted-foreground">
              Ask discipline-specific questions, capture AI syntheses, and spin up academic training sessions.
            </p>
            <form onSubmit={handleAcademicResearch} className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Project title</label>
                <input
                  value={researchTitle}
                  onChange={(event) => setResearchTitle(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm"
                  placeholder="e.g. Civic tech literacy curriculum"
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Research question</label>
                <textarea
                  value={researchQuestion}
                  onChange={(event) => setResearchQuestion(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm"
                  placeholder="How do hybrid learning models impact postsecondary STEM retention?"
                  required
                />
              </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Instructions (optional)</label>
              <textarea
                value={researchInstructions}
                onChange={(event) => setResearchInstructions(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm"
                placeholder="Emphasize peer-reviewed studies post-2018."
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Discipline</label>
              <select
                value={researchDiscipline}
                onChange={(event) => setResearchDiscipline(event.target.value as DisciplineOption)}
                className="mt-1 w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm"
              >
                {DISCIPLINES.map((discipline) => (
                  <option key={discipline} value={discipline}>
                    {discipline}
                  </option>
                ))}
              </select>
            </div>
              <button
                type="submit"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                disabled={researchLoading}
              >
                {researchLoading ? "Researching…" : "Run academic research"}
              </button>
            </form>
            {academicProjectError ? (
              <p className="text-sm text-destructive">{academicProjectError}</p>
            ) : null}
          </div>
        </div>
        {researchAnswer ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <h3 className="text-lg font-semibold">Answer</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{researchAnswer}</pre>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveAcademicProject}
                className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/80 disabled:opacity-60"
                disabled={savingAcademicProject}
              >
                {savingAcademicProject ? "Saving…" : "Save as project"}
              </button>
            </div>
          </div>
        ) : null}
        {researchCitations.length ? (
          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-semibold">Citations</h3>
            {researchCitations.map((citation) => (
              <article key={citation.document_id + citation.source} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-semibold">
                  {citation.source} · {citation.title}
                </p>
                <p className="text-sm text-muted-foreground">{citation.excerpt}</p>
              </article>
            ))}
          </div>
        ) : null}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Saved academic projects</h3>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {academicProjectsLoading ? "Loading…" : `${filteredAcademicProjects.length} shown`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Discipline</label>
              <select
                value={projectDisciplineFilter}
                onChange={(event) =>
                  setProjectDisciplineFilter(event.target.value as DisciplineOption | "All")
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-3 py-1 text-sm"
              >
                <option value="All">All</option>
                {DISCIPLINES.map((discipline) => (
                  <option key={discipline} value={discipline}>
                    {discipline}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filteredAcademicProjects.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No academic projects yet. Save a research run above.</p>
          ) : (
            <div className="mt-4 grid gap-4">
              {filteredAcademicProjects.map((project) => (
                <article key={project.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">{project.title}</p>
                      <p className="text-sm text-muted-foreground">{project.question}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        {project.discipline || "Interdisciplinary"}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {new Date(project.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                    {project.last_answer || "No summary yet."}
                  </p>
                  <div className="mt-3">
                    {project.session_id ? (
                      <span className="rounded-full bg-green-500/10 px-4 py-1 text-xs font-semibold text-green-500">
                        Training session linked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCreateAcademicSession(project.id)}
                        className="rounded-full border border-border/70 px-4 py-1 text-sm font-semibold text-foreground transition hover:border-foreground/80 disabled:opacity-60"
                        disabled={!!sessionCreateState[project.id]}
                      >
                        {sessionCreateState[project.id] ? "Creating session…" : "Create training session"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5 lg:col-span-2">
          <h2 className="text-2xl font-semibold">Research programs</h2>
          <p className="text-sm text-muted-foreground">Track topics, questions, and timelines.</p>
          <form onSubmit={handleAddTrack} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Topic</label>
              <input
                value={trackForm.topic}
                onChange={(event) => setTrackForm((prev) => ({ ...prev, topic: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="e.g. Equitable transit design"
                required
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Guiding question</label>
              <textarea
                value={trackForm.question}
                onChange={(event) => setTrackForm((prev) => ({ ...prev, question: event.target.value }))}
                className="min-h-[100px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="What are you trying to discover?"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timeframe</label>
              <input
                value={trackForm.timeframe}
                onChange={(event) => setTrackForm((prev) => ({ ...prev, timeframe: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="e.g. Fall 2024"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</label>
              <select
                value={trackForm.status}
                onChange={(event) => setTrackForm((prev) => ({ ...prev, status: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {["Exploratory", "In progress", "Writing", "Submitted"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="md:col-span-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Add research track
            </button>
          </form>
          <div className="mt-6 space-y-4">
            {tracks.map((track) => (
              <article key={track.id} className="rounded-2xl border border-border/40 bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <h3 className="font-semibold">{track.topic}</h3>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{track.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">{track.question}</p>
                <p className="text-xs text-muted-foreground">Timeframe: {track.timeframe}</p>
              </article>
            ))}
            {tracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No research tracks yet. Add one above.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Study tasks</h2>
          <p className="text-sm text-muted-foreground">Quick obligations you can mirror into the Planner calendar.</p>
          <form onSubmit={handleAddTask} className="mt-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Task</label>
              <input
                value={taskForm.label}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, label: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Schedule advisor sync"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Due / reminder</label>
              <input
                value={taskForm.due}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, due: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Friday"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Priority</label>
              <select
                value={taskForm.priority}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value as StudyTask["priority"] }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {["High", "Medium", "Low"].map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Add task
            </button>
          </form>
          <div className="mt-6 space-y-3">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-2xl border border-border/40 bg-background/70 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{task.label}</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{task.priority}</span>
                </div>
                <p className="text-xs text-muted-foreground">Due: {task.due || "TBD"}</p>
              </article>
            ))}
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks logged yet.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Sources & citations</h2>
          <p className="text-sm text-muted-foreground">Log references so AI can build bibliographies and fact-check drafts.</p>
          <form onSubmit={handleAddSource} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Title</label>
              <input
                value={sourceForm.title}
                onChange={(event) => setSourceForm((prev) => ({ ...prev, title: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Article or dataset name"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Type</label>
              <input
                value={sourceForm.type}
                onChange={(event) => setSourceForm((prev) => ({ ...prev, type: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Journal / Book / Dataset"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reliability tag</label>
              <select
                value={sourceForm.reliability}
                onChange={(event) => setSourceForm((prev) => ({ ...prev, reliability: event.target.value as SourceRecord["reliability"] }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {(["Key", "Support", "Review"] as const).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Link</label>
              <input
                value={sourceForm.link}
                onChange={(event) => setSourceForm((prev) => ({ ...prev, link: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="https://"
              />
            </div>
            <button
              type="submit"
              className="md:col-span-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Save source
            </button>
          </form>
          <div className="mt-6 space-y-3">
            {sources.map((source) => (
              <article key={source.id} className="rounded-2xl border border-border/40 bg-background/70 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{source.title}</h3>
                    <p className="text-xs text-muted-foreground">{source.type}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{source.reliability}</span>
                </div>
                {source.link ? (
                  <a href={source.link} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                    {source.link}
                  </a>
                ) : null}
              </article>
            ))}
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources yet. Add your first reference above.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Writing workspace</h2>
          <p className="text-sm text-muted-foreground">Track drafts and note what assistance you need from AI.</p>
          <form onSubmit={handleAddDraft} className="mt-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Title</label>
              <input
                value={draftForm.title}
                onChange={(event) => setDraftForm((prev) => ({ ...prev, title: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Whitepaper name"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Focus / section</label>
              <input
                value={draftForm.focus}
                onChange={(event) => setDraftForm((prev) => ({ ...prev, focus: event.target.value }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Methodology, abstract, etc."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</label>
              <select
                value={draftForm.status}
                onChange={(event) => setDraftForm((prev) => ({ ...prev, status: event.target.value as WritingDraft["status"] }))}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {(["Notes", "Outline", "Drafting", "Editing"] as const).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Summary / next help needed</label>
              <textarea
                value={draftForm.summary}
                onChange={(event) => setDraftForm((prev) => ({ ...prev, summary: event.target.value }))}
                className="min-h-[120px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Describe analysis or editing support"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Save draft snapshot
            </button>
          </form>
          <div className="mt-6 space-y-4">
            {drafts.map((draft) => (
              <article key={draft.id} className="rounded-2xl border border-border/40 bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <h3 className="font-semibold">{draft.title}</h3>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{draft.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">{draft.focus}</p>
                <p className="text-xs text-muted-foreground">{draft.summary}</p>
              </article>
            ))}
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No drafts yet. Start tracking your writing above.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5 lg:col-span-2">
          <h2 className="text-2xl font-semibold">AI collaboration notes</h2>
          <p className="text-sm text-muted-foreground">Remind future assistants how to help across research, sources, and drafting.</p>
          <div className="mt-4 space-y-4">
            {planOptions.map((suggestion) => (
              <article key={suggestion.id} className="rounded-2xl border border-border/40 bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{suggestion.cadence}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{suggestion.title}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{suggestion.summary}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {suggestion.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      {action}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
            Future idea: connect this dashboard to versioned research notes + writing briefs so the AI can cite previous
            outputs automatically.
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Reference queue</h2>
          <p className="text-sm text-muted-foreground">Park ideas you want to explore later.</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="rounded-2xl border border-border/40 bg-background/70 p-4">
              <p className="font-semibold">Grant trackers</p>
              <p className="text-muted-foreground">Ask AI to summarize open grants and push deadlines into Planner reminders.</p>
            </li>
            <li className="rounded-2xl border border-border/40 bg-background/70 p-4">
              <p className="font-semibold">Literature summaries</p>
              <p className="text-muted-foreground">Batch upload PDFs for auto-summaries and highlight extraction.</p>
            </li>
            <li className="rounded-2xl border border-border/40 bg-background/70 p-4">
              <p className="font-semibold">Writing sprints</p>
              <p className="text-muted-foreground">Pair timed focus blocks with Life Dashboard tasks for accountability.</p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
