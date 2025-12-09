"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type Citation = {
  source: string;
  document_id: string;
  title: string;
  excerpt: string;
};

type LegalProject = {
  id: string;
  title: string;
  question: string;
  instructions: string;
  last_answer: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function LegalProjectsDashboard() {
  const { isLoaded, isSignedIn } = useAuth();
  const [query, setQuery] = useState("");
  const [instructions, setInstructions] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [projects, setProjects] = useState<LegalProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [sessionCreateState, setSessionCreateState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const fetchProjects = async () => {
      setProjectsLoading(true);
      setProjectError(null);
      try {
        const response = await fetch("/api/legal-projects");
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Failed to load projects");
        }
        const body = (await response.json()) as { projects: LegalProject[] };
        setProjects(body.projects);
      } catch (err) {
        console.error(err);
        setProjectError(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setProjectsLoading(false);
      }
    };
    fetchProjects();
  }, [isLoaded, isSignedIn]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter a legal research question first.");
      return;
    }
    setLoading(true);
    setError(null);
    setAnswer("");
    setCitations([]);
    try {
      const response = await fetch("/api/legal-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, instructions }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Legal research failed");
      }
      const body = (await response.json()) as { answer: string; citations: Citation[] };
      setAnswer(body.answer);
      setCitations(body.citations);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Legal research failed");
    } finally {
      setLoading(false);
    }
  };

  const refreshProjects = async () => {
    try {
      const response = await fetch("/api/legal-projects");
      if (!response.ok) {
        throw new Error("Failed to load projects");
      }
      const body = (await response.json()) as { projects: LegalProject[] };
      setProjects(body.projects);
    } catch (err) {
      console.error(err);
      setProjectError(err instanceof Error ? err.message : "Failed to load projects");
    }
  };

  const handleSaveProject = async () => {
    if (!projectTitle.trim()) {
      setProjectError("Project title required before saving.");
      return;
    }
    if (!answer.trim()) {
      setProjectError("Run research first to capture an answer.");
      return;
    }
    setSavingProject(true);
    setProjectError(null);
    try {
      const response = await fetch("/api/legal-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          question: query,
          instructions,
          answer,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to save project");
      }
      await refreshProjects();
      setProjectTitle("");
    } catch (err) {
      console.error(err);
      setProjectError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSavingProject(false);
    }
  };

  const handleCreateSession = async (projectId: string) => {
    setSessionCreateState((prev) => ({ ...prev, [projectId]: true }));
    setProjectError(null);
    try {
      const response = await fetch(`/api/legal-projects/${projectId}/session`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to create training session");
      }
      await refreshProjects();
    } catch (err) {
      console.error(err);
      setProjectError(err instanceof Error ? err.message : "Failed to create training session");
    } finally {
      setSessionCreateState((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  if (!isLoaded) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Checking authentication…
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Sign in to access legal projects.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Legal Projects</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI-powered legal research</h1>
        <p className="text-muted-foreground">
          Ask jurisdiction-specific questions and get structured answers grounded in your corpora. Use the
          citations to jump back into primary sources.
        </p>
      </header>

      <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Project title
            </label>
            <input
              type="text"
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm"
              placeholder="e.g., RCW 26.09 homeschooling best-interest brief"
            />
          </div>
          <div>
            <label className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Research question
            </label>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm"
              placeholder="How can we argue best-interest factors in Washington when homeschooling is at issue?"
            />
          </div>
          <div>
            <label className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Extra instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm"
              placeholder="Emphasize RCW 26.09 language and procedural posture notes."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Researching…" : "Search"}
            </button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </form>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
          Running retrieval + analysis…
        </div>
      ) : null}

      {answer ? (
        <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Answer</h2>
          <pre className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{answer}</pre>
        </section>
      ) : null}

      {answer ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveProject}
            className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/80 disabled:opacity-60"
            disabled={savingProject}
          >
            {savingProject ? "Saving…" : "Save as project"}
          </button>
          {projectError ? <p className="text-sm text-destructive">{projectError}</p> : null}
        </div>
      ) : null}

      <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Saved projects</h2>
            <p className="text-sm text-muted-foreground">
              Track active matters, revisit answers, and spawn training sessions when ready.
            </p>
          </div>
          {projectsLoading ? (
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Loading…</span>
          ) : (
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {projects.length} projects
            </span>
          )}
        </div>
        {projectError && !answer ? (
          <p className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {projectError}
          </p>
        ) : null}
        {projects.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No saved projects yet. Run research and click “Save as project” to capture it here.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-border/70 bg-background/70 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{project.title}</h3>
                    <p className="text-sm text-muted-foreground">{project.question}</p>
                  </div>
                  <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {new Date(project.updated_at).toLocaleString()}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                  {project.last_answer || "No summary saved yet."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  {project.session_id ? (
                    <span className="rounded-full bg-green-500/10 px-4 py-1 text-green-500">
                      Training session linked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCreateSession(project.id)}
                      className="rounded-full border border-border/70 px-4 py-1 text-foreground transition hover:border-foreground/80 disabled:opacity-60"
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
      </section>

      {citations.length ? (
        <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Citations</h2>
          <div className="mt-4 space-y-3">
            {citations.map((citation) => (
              <article key={citation.document_id + citation.source} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-semibold">{citation.source} · {citation.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{citation.excerpt}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
