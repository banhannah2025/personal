"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import clsx from "clsx";
import type { RetrievedChunk } from "@/lib/rag";

type DomainType = "legal" | "academic";

type CorpusSummary = {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  access_level: string;
  metadata: Record<string, unknown> | null;
  document_count: number;
};

type DocumentStats = {
  total: number;
  statuses: Record<string, number>;
};

type SessionStats = {
  total: number;
  statuses: Record<string, number>;
};

type SessionSummary = {
  id: string;
  title: string;
  status: string;
  objective: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type GeneratedDocumentSummary = {
  id: string;
  title: string;
  doc_type: string;
  status: string;
  validation_status: string;
  created_at: string;
};

type FeedbackEntry = {
  id: string;
  issue_type: string;
  severity: string;
  notes: string;
  created_at: string;
};

type IngestionJob = {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
};

type RetrainingJob = {
  id: string;
  source: string;
  status: string;
  dataset_size: number | null;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
};

type PromptTemplate = {
  id: string;
  name: string;
  description: string | null;
  template_kind: string;
  domain: DomainType;
  instructions: string;
};

type DashboardResponse = {
  domain: DomainType;
  corpora: CorpusSummary[];
  documentStats: DocumentStats;
  sessionStats: SessionStats;
  latestSessions: SessionSummary[];
  generatedDocuments: GeneratedDocumentSummary[];
  feedbackEntries: FeedbackEntry[];
  ingestionJobs: IngestionJob[];
  retrainingJobs: RetrainingJob[];
  promptTemplates: PromptTemplate[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SessionFormState = {
  title: string;
  objective: string;
  scheduled_for: string;
};

type RunFormState = {
  sessionId: string;
  promptTemplateId: string;
  query: string;
  additionalFacts: string;
};

type FormUpdates = {
  session?: Partial<SessionFormState>;
  run?: Partial<RunFormState>;
};

const DOMAIN_OPTIONS: { value: DomainType; label: string; description: string }[] = [
  {
    value: "legal",
    label: "Legal Lab",
    description: "Training around statutes, rules, pleadings, and courtroom reasoning.",
  },
  {
    value: "academic",
    label: "Academic Lab",
    description: "STEM, humanities, and professional disciplines using academic rubrics.",
  },
];

const DOCUMENT_LABELS: Record<string, string> = {
  pending_ingest: "Queued",
  ingested: "Ingested",
  needs_review: "Needs Review",
  archived: "Archived",
};

const SESSION_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "Running",
  needs_input: "Needs Input",
  completed: "Finished",
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Training dashboard request failed");
  }
  return (await response.json()) as T;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractFormUpdates(text: string): FormUpdates | null {
  const match = text.match(/```json([\s\S]*?)```/i);
  const jsonCandidate = match ? match[1] : text.trim();
  try {
    const parsed = JSON.parse(jsonCandidate) as { form_updates?: unknown };
    const { form_updates } = parsed;
    if (!form_updates || typeof form_updates !== "object") {
      return null;
    }
    return form_updates as FormUpdates;
  } catch {
    return null;
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function AiTrainingDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [domain, setDomain] = useState<DomainType>("legal");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [createLoading, setCreateLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<SessionFormState>({
    title: "",
    objective: "",
    scheduled_for: "",
  });
  const [runForm, setRunForm] = useState<RunFormState>({
    sessionId: "",
    promptTemplateId: "",
    query: "",
    additionalFacts: "",
  });
  const [runOutput, setRunOutput] = useState<string>("");
  const [runRetrieval, setRunRetrieval] = useState<RetrievedChunk[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchJson<DashboardResponse>(`/api/training-dashboard?domain=${domain}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (payload) => {
        if (!isMounted) return;
        setData(payload);
        const sessionPayload = await fetchJson<{ sessions: SessionSummary[] }>(
          `/api/training-sessions?domain=${domain}`
        );
        if (isMounted) {
          setSessions(sessionPayload.sessions);
          if (sessionPayload.sessions.length) {
            setRunForm((prev) =>
              prev.sessionId ? prev : { ...prev, sessionId: sessionPayload.sessions[0].id }
            );
          }
          if (payload.promptTemplates.length) {
            setRunForm((prev) =>
              prev.promptTemplateId
                ? prev
                : { ...prev, promptTemplateId: payload.promptTemplates[0].id }
            );
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [domain, isLoaded, isSignedIn, refreshIndex]);

  const domainDetails = useMemo(
    () => DOMAIN_OPTIONS.find((option) => option.value === domain),
    [domain]
  );

  const handleCreateSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    setFormError(null);
    setCreateLoading(true);
    try {
      const { session } = await fetchJson<{ session: SessionSummary }>("/api/training-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          title: createForm.title,
          objective: createForm.objective,
          scheduled_for: createForm.scheduled_for || null,
        }),
      });
      setSessions((prev) => [session, ...prev].slice(0, 20));
      setCreateForm({ title: "", objective: "", scheduled_for: "" });
      setRefreshIndex((prev) => prev + 1);
      if (!runForm.sessionId) {
        setRunForm((prev) => ({ ...prev, sessionId: session.id }));
      }
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Failed to create session.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRunSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!runForm.sessionId || !runForm.promptTemplateId || !runForm.query.trim()) {
      setFormError("Session, prompt template, and query are required.");
      return;
    }
    setRunLoading(true);
    setFormError(null);
    setRunOutput("");
    setRunRetrieval([]);
    try {
      const response = await fetchJson<{
        runId: string;
        documentId: string;
        content: string;
        retrieval: RetrievedChunk[];
      }>(`/api/training-sessions/${runForm.sessionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptTemplateId: runForm.promptTemplateId,
          query: runForm.query,
          additionalFacts: runForm.additionalFacts,
        }),
      });
      setRunOutput(response.content);
      setRunRetrieval(response.retrieval);
      setRefreshIndex((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Training run failed.");
    } finally {
      setRunLoading(false);
    }
  };

  const handleApplyFormUpdates = (updates: FormUpdates | null) => {
    if (!updates) return;
    if (updates.session) {
      setCreateForm((prev) => ({
        ...prev,
        ...updates.session,
      }));
    }
    if (updates.run) {
      setRunForm((prev) => ({
        ...prev,
        ...updates.run,
      }));
    }
  };

  const handleSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const nextMessages = [...chatMessages, { role: "user" as const, content: trimmed }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await fetchJson<{ reply: string }>(`/api/training-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          instructions: customInstructions,
          messages: nextMessages,
        }),
      });
      const assistantMessage: ChatMessage = { role: "assistant", content: response.reply };
      setChatMessages((prev) => [...prev, assistantMessage]);
      const updates = extractFormUpdates(response.reply);
      if (updates) {
        handleApplyFormUpdates(updates);
      }
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setChatLoading(false);
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
        Sign in to access the AI training workspace.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">AI Training</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Legal + Academic Labs</h1>
            <p className="text-muted-foreground">
              Monitor corpora, training sessions, outputs, and feedback from a single command
              center.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {DOMAIN_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDomain(option.value)}
                className={clsx(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition",
                  domain === option.value
                    ? "border-primary bg-primary text-primary-foreground shadow"
                    : "border-border/70 text-foreground hover:border-foreground/60"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {domainDetails?.description ?? "Select a lab to view progress."}
        </p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
          Loading {domainDetails?.label ?? "domain"} metrics…
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/60 bg-destructive/10 p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <>
          <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 space-y-3">
                <h2 className="text-2xl font-semibold">AI training chat</h2>
                <p className="text-sm text-muted-foreground">
                  Ask questions, share instructions, and let CodexLab Coach prefill the forms below.
                  End a message with a request like “fill out a session plan for X” to push values into the form.
                </p>
                <label className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Custom instructions
                  <textarea
                    value={customInstructions}
                    onChange={(event) => setCustomInstructions(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-2 text-sm"
                    placeholder="e.g. Always prioritize Washington RCWs and parent rights cases."
                  />
                </label>
                <div className="h-64 overflow-auto rounded-2xl border border-border/50 bg-background/60 p-3 text-sm">
                  {chatMessages.length === 0 ? (
                    <p className="text-muted-foreground">
                      Start chatting to capture reasoning instructions and have the AI populate form fields.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {chatMessages.map((message, index) => (
                        <li key={`${message.role}-${index}`} className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                            {message.role === "user" ? "You" : "CodexLab"}
                          </p>
                          <div className="rounded-2xl border border-border/40 bg-card/60 px-3 py-2">
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <form onSubmit={handleSendChat} className="flex flex-col gap-3">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    className="w-full rounded-2xl border border-border/50 bg-background/70 px-3 py-2 text-sm"
                    placeholder="Describe what you want the AI lab to focus on…"
                  />
                  <button
                    type="submit"
                    className="self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    disabled={chatLoading}
                  >
                    {chatLoading ? "Consulting…" : "Send"}
                  </button>
                </form>
              </div>
            </div>
          </section>
          <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Training controls</h2>
                <p className="text-sm text-muted-foreground">
                  Launch new sessions, then run retrieval + synthesis chains.
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Pipeline
              </span>
            </div>
            {formError ? (
              <p className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <form onSubmit={handleCreateSession} className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-5">
                <h3 className="text-lg font-semibold">New training session</h3>
                <label className="block text-sm font-medium">
                  Title
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                    placeholder="Parental rights motion playbook"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Objective
                  <textarea
                    value={createForm.objective}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, objective: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                    placeholder="Codify heightened evidentiary arguments for RCW 26.09 cases."
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  disabled={createLoading}
                >
                  {createLoading ? "Creating…" : "Create session"}
                </button>
              </form>
              <form onSubmit={handleRunSession} className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-5">
                <h3 className="text-lg font-semibold">Run retrieval + synthesis</h3>
                <label className="block text-sm font-medium">
                  Session
                  <select
                    value={runForm.sessionId}
                    onChange={(event) => setRunForm((prev) => ({ ...prev, sessionId: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                  >
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Prompt template
                  <select
                    value={runForm.promptTemplateId}
                    onChange={(event) =>
                      setRunForm((prev) => ({ ...prev, promptTemplateId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                  >
                    {(data.promptTemplates ?? []).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Query / target outcome
                  <textarea
                    value={runForm.query}
                    onChange={(event) => setRunForm((prev) => ({ ...prev, query: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                    placeholder="How can we argue best-interest factors for hybrid homeschooling?"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Additional facts
                  <textarea
                    value={runForm.additionalFacts}
                    onChange={(event) =>
                      setRunForm((prev) => ({ ...prev, additionalFacts: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-border/50 bg-card/50 px-3 py-2 text-sm"
                    placeholder="Guardian ad litem recommended reunification within 60 days."
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  disabled={runLoading}
                >
                  {runLoading ? "Running pipeline…" : "Run training"}
                </button>
              </form>
            </div>
            {runOutput ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Latest output
                  </h4>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-foreground/90">
                    {runOutput}
                  </pre>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Retrieval
                  </h4>
                  {runRetrieval.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No chunks returned.</p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm">
                      {runRetrieval.map((chunk, index) => (
                        <li key={chunk.chunk_id} className="rounded-xl border border-border/50 bg-card/40 p-3">
                          <p className="font-semibold">
                            Source {index + 1}: {chunk.document_title}
                          </p>
                          <p className="text-xs text-muted-foreground">Score {chunk.score.toFixed(3)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Corpus health</h2>
                  <p className="text-sm text-muted-foreground">
                    Snapshot of all documents and ingestion states.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Documents
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-background/70 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Total sources
                  </p>
                  <p className="mt-2 text-4xl font-semibold">{data.documentStats.total}</p>
                </div>
                <div className="space-y-2">
                  {Object.entries(DOCUMENT_LABELS).map(([status, label]) => (
                    <div key={status} className="flex items-center justify-between rounded-full bg-muted/50 px-4 py-2 text-sm">
                      <span>{label}</span>
                      <span className="font-semibold">{data.documentStats.statuses[status] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Training cadence</h2>
                  <p className="text-sm text-muted-foreground">
                    Sessions in draft, active work, or awaiting your feedback.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Sessions
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-background/70 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Total sessions
                  </p>
                  <p className="mt-2 text-4xl font-semibold">{data.sessionStats.total}</p>
                </div>
                <div className="space-y-2">
                  {Object.entries(SESSION_LABELS).map(([status, label]) => (
                    <div key={status} className="flex items-center justify-between rounded-full bg-muted/50 px-4 py-2 text-sm">
                      <span>{label}</span>
                      <span className="font-semibold">{data.sessionStats.statuses[status] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Corpus collections</h2>
                <p className="text-sm text-muted-foreground">
                  Every dataset the lab can pull from, plus preferred formats.
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {data.corpora.length} collections
              </span>
            </div>
            {data.corpora.length === 0 ? (
              <EmptyState message="No corpora defined yet. Upload source documents to begin training." />
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {data.corpora.map((corpus) => (
                  <article
                    key={corpus.id}
                    className="rounded-2xl border border-border/70 bg-background/70 p-5 transition hover:border-primary/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{corpus.name}</h3>
                        <p className="text-sm text-muted-foreground">{corpus.description}</p>
                      </div>
                      <div className="text-right text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        {corpus.source_type}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="rounded-full bg-muted/50 px-3 py-1 text-xs uppercase tracking-wide">
                        {corpus.access_level}
                      </span>
                      <span>{corpus.document_count} documents</span>
                      {Array.isArray(corpus.metadata?.preferred_format) ? (
                        <span>
                          Prefers{" "}
                          {(corpus.metadata?.preferred_format as string[]).join(", ").toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent sessions</h2>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Last 5</span>
              </div>
              {data.latestSessions.length === 0 ? (
                <EmptyState message="No training sessions logged yet." />
              ) : (
                <div className="mt-4 space-y-3">
                  {data.latestSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">{session.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.objective || "No objective provided."}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted/60 px-3 py-1 text-xs uppercase tracking-wide">
                          {SESSION_LABELS[session.status] ?? session.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Created {formatDate(session.created_at)} · Scheduled {formatDate(session.scheduled_for)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Latest outputs</h2>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Documents</span>
              </div>
              {data.generatedDocuments.length === 0 ? (
                <EmptyState message="No generated documents yet. Run a session to produce drafts." />
              ) : (
                <div className="mt-4 space-y-3">
                  {data.generatedDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">{doc.doc_type}</p>
                        </div>
                        <div className="text-right text-xs uppercase tracking-[0.3em] text-muted-foreground">
                          <div>{doc.status}</div>
                          <div>{doc.validation_status}</div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Generated {formatDate(doc.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Open feedback</h2>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {data.feedbackEntries.length} items
                </span>
              </div>
              {data.feedbackEntries.length === 0 ? (
                <EmptyState message="No unresolved feedback. Great job!" />
              ) : (
                <div className="mt-4 space-y-3">
                  {data.feedbackEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{entry.issue_type}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{entry.notes}</p>
                        </div>
                        <span className="rounded-full bg-muted/60 px-3 py-1 text-xs uppercase tracking-wide">
                          {entry.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Logged {formatDate(entry.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Pipelines & retraining</h2>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Automation
                </span>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Ingestion jobs</p>
                  {data.ingestionJobs.length === 0 ? (
                    <EmptyState message="No ingestion jobs queued." />
                  ) : (
                    <div className="mt-3 space-y-3">
                      {data.ingestionJobs.map((job) => (
                        <div key={job.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{job.job_type}</span>
                            <span className="rounded-full bg-muted/60 px-3 py-1 text-xs uppercase tracking-wide">
                              {job.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Started {formatDate(job.created_at)}{" "}
                            {job.completed_at ? `· Completed ${formatDate(job.completed_at)}` : ""}
                          </p>
                          {job.error_message ? (
                            <p className="mt-1 text-xs text-destructive">{job.error_message}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">Retraining queue</p>
                  {data.retrainingJobs.length === 0 ? (
                    <EmptyState message="No retraining jobs scheduled." />
                  ) : (
                    <div className="mt-3 space-y-3">
                      {data.retrainingJobs.map((job) => (
                        <div key={job.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{job.source}</span>
                            <span className="rounded-full bg-muted/60 px-3 py-1 text-xs uppercase tracking-wide">
                              {job.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Dataset size: {job.dataset_size ?? 0} · Queued {formatDate(job.created_at)}
                          </p>
                          {job.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">{job.notes}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <EmptyState message="No data returned for this domain yet." />
      )}
    </div>
  );
}
