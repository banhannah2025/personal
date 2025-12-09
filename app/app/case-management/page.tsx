"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { nanoid } from "nanoid";
import { ArrowRight, Briefcase, FileText, Gavel, Scale, Sparkles } from "lucide-react";
import Link from "next/link";

type Party = {
  id: string;
  name: string;
  role: "Plaintiff" | "Defendant" | "Witness" | "Expert" | "Other";
  contact: string;
};

type NoteEntry = {
  id: string;
  type: "Note" | "Fact" | "Evidence";
  content: string;
  owner: string;
  createdAt: string;
};

type LawReference = {
  id: string;
  kind: "Statute" | "Legislation" | "Precedent" | "Constitutional";
  citation: string;
  summary: string;
};

type Witness = {
  id: string;
  name: string;
  testimony: string;
  relevance: string;
};

type CaseRecord = {
  id: string;
  title: string;
  docket: string;
  jurisdiction: string;
  desiredOutcome: string;
  parties: Party[];
  witnesses: Witness[];
  entries: NoteEntry[];
  lawReferences: LawReference[];
  createdAt: string;
};

type CaseSuggestion = {
  id: string;
  category: string;
  title: string;
  detail: string;
};

type Citation = {
  source: string;
  document_id: string;
  title: string;
  excerpt: string;
};

const ROLES: Party["role"][] = ["Plaintiff", "Defendant", "Witness", "Expert", "Other"];
const LAW_KINDS: LawReference["kind"][] = ["Statute", "Legislation", "Precedent", "Constitutional"];

const createCase = (): CaseRecord => ({
  id: `local-${nanoid()}`,
  title: "Untitled case",
  docket: "",
  jurisdiction: "",
  desiredOutcome: "",
  parties: [],
  witnesses: [],
  entries: [],
  lawReferences: [],
  createdAt: new Date().toISOString(),
});

export default function CaseManagementPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [partyForm, setPartyForm] = useState({ name: "", role: ROLES[0], contact: "" });
  const [witnessForm, setWitnessForm] = useState({ name: "", testimony: "", relevance: "" });
  const [entryText, setEntryText] = useState("");
  const [entryType, setEntryType] = useState<NoteEntry["type"]>("Note");
  const [entryOwner, setEntryOwner] = useState("Attorney of record");
  const [lawForm, setLawForm] = useState({ kind: LAW_KINDS[0], citation: "", summary: "" });
  const [aiQuery, setAiQuery] = useState("Summarize controlling statutes for this case");
  const [aiInstructions, setAiInstructions] = useState("Return bullet list of statutes + key holdings.");
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [aiCitations, setAiCitations] = useState<Citation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CaseSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestionWarnings, setSuggestionWarnings] = useState<string[]>([]);
  const [suggestionCitations, setSuggestionCitations] = useState<string[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [savingCase, setSavingCase] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);

  const activeCase = useMemo(() => cases.find((item) => item.id === activeCaseId) ?? cases[0], [cases, activeCaseId]);

  const fetchCases = useCallback(async () => {
    if (!isSignedIn) {
      const fallback = createCase();
      setCases([fallback]);
      setActiveCaseId(fallback.id);
      setLoadingCases(false);
      setCaseError("Sign in to sync case files.");
      return;
    }
    setLoadingCases(true);
    setCaseError(null);
    try {
      const response = await fetch("/api/cases");
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Unable to load cases");
      }
      const remoteCases = (body?.cases ?? []) as CaseRecord[];
      if (remoteCases.length === 0) {
        const initial = createCase();
        setCases([initial]);
        setActiveCaseId(initial.id);
      } else {
        setCases(remoteCases);
        setActiveCaseId((prev) => prev && remoteCases.some((c) => c.id === prev) ? prev : remoteCases[0].id);
      }
    } catch (error) {
      setCaseError((error as Error).message);
      const fallback = createCase();
      setCases([fallback]);
      setActiveCaseId(fallback.id);
    } finally {
      setLoadingCases(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchCases();
  }, [isLoaded, fetchCases]);

  const updateCase = (partial: Partial<CaseRecord>) => {
    if (!activeCase) return;
    setCases((prev) => prev.map((item) => (item.id === activeCase.id ? { ...item, ...partial } : item)));
  };

  const handleAddCase = () => {
    const newCase = createCase();
    setCases((prev) => [newCase, ...prev]);
    setActiveCaseId(newCase.id);
  };

  const handleAddParty = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!partyForm.name.trim()) return;
    updateCase({ parties: [...(activeCase?.parties ?? []), { ...partyForm, id: nanoid() }] });
    setPartyForm({ name: "", role: partyForm.role, contact: "" });
  };

  const handleAddEntry = () => {
    if (!entryText.trim()) return;
    updateCase({
      entries: [
        {
          id: nanoid(),
          type: entryType,
          content: entryText.trim(),
          owner: entryOwner.trim() || "Team",
          createdAt: new Date().toISOString(),
        },
        ...(activeCase?.entries ?? []),
      ],
    });
    setEntryText("");
  };

  const handleAddWitness = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!witnessForm.name.trim()) return;
    updateCase({
      witnesses: [
        ...(activeCase?.witnesses ?? []),
        {
          id: nanoid(),
          name: witnessForm.name.trim(),
          testimony: witnessForm.testimony.trim(),
          relevance: witnessForm.relevance.trim(),
        },
      ],
    });
    setWitnessForm({ name: "", testimony: "", relevance: "" });
  };

  const handleAddLawReference = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lawForm.citation.trim()) return;
    updateCase({
      lawReferences: [
        ...(activeCase?.lawReferences ?? []),
        { id: nanoid(), kind: lawForm.kind, citation: lawForm.citation.trim(), summary: lawForm.summary.trim() },
      ],
    });
    setLawForm({ ...lawForm, citation: "", summary: "" });
  };

  const handleAiResearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!aiQuery.trim()) {
      setAiError("Enter a question or instruction for the assistant.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiAnswer("");
    setAiCitations([]);
    try {
      const response = await fetch("/api/legal-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery, instructions: aiInstructions }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "AI research failed");
      }
      setAiAnswer(body.answer ?? "");
      setAiCitations(body.citations ?? []);
    } catch (error) {
      setAiError((error as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const normalizedCaseForApi = () => {
    if (!activeCase) return null;
    return {
      title: activeCase.title,
      docket: activeCase.docket,
      jurisdiction: activeCase.jurisdiction,
      desiredOutcome: activeCase.desiredOutcome,
      parties: activeCase.parties,
      witnesses: activeCase.witnesses,
      entries: activeCase.entries,
      lawReferences: activeCase.lawReferences,
    };
  };

  const handleGetSuggestions = async () => {
    const payload = normalizedCaseForApi();
    if (!payload) return;
    setSuggestionsLoading(true);
    setSuggestionError(null);
    try {
      const response = await fetch("/api/case-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseRecord: payload }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Failed to fetch suggestions");
      }
      const incoming: CaseSuggestion[] = (body?.suggestions ?? []).map((suggestion: CaseSuggestion) => ({
        id: suggestion.id || nanoid(),
        category: suggestion.category,
        title: suggestion.title,
        detail: suggestion.detail,
      }));
      setSuggestions(incoming);
      setSuggestionCitations(body?.citations ?? []);
      setSuggestionWarnings(body?.warnings ?? []);
    } catch (error) {
      setSuggestionError((error as Error).message);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const applySuggestion = (suggestion: CaseSuggestion) => {
    if (!activeCase) return;
    switch (suggestion.category) {
      case "party":
        updateCase({
          parties: [
            ...activeCase.parties,
            { id: nanoid(), name: suggestion.title, role: "Other", contact: suggestion.detail },
          ],
        });
        break;
      case "witness":
        updateCase({
          witnesses: [
            ...activeCase.witnesses,
            {
              id: nanoid(),
              name: suggestion.title,
              testimony: suggestion.detail,
              relevance: "AI recommendation",
            },
          ],
        });
        break;
      case "outcome":
        updateCase({
          desiredOutcome: `${activeCase.desiredOutcome}\n${suggestion.title} - ${suggestion.detail}`.trim(),
        });
        break;
      case "fact":
      case "note":
        updateCase({
          entries: [
            {
              id: nanoid(),
              type: suggestion.category === "fact" ? "Fact" : "Note",
              content: `${suggestion.title}: ${suggestion.detail}`,
              owner: "AI recommendation",
              createdAt: new Date().toISOString(),
            },
            ...activeCase.entries,
          ],
        });
        break;
      case "evidence":
        updateCase({
          entries: [
            {
              id: nanoid(),
              type: "Evidence",
              content: `${suggestion.title}: ${suggestion.detail}`,
              owner: "AI recommendation",
              createdAt: new Date().toISOString(),
            },
            ...activeCase.entries,
          ],
        });
        break;
      case "law":
        updateCase({
          lawReferences: [
            ...activeCase.lawReferences,
            { id: nanoid(), kind: "Precedent", citation: suggestion.title, summary: suggestion.detail },
          ],
        });
        break;
      default:
        break;
    }
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
  };

  const handleSaveCase = async () => {
    if (!activeCase || !isSignedIn) {
      setCaseError("Sign in to save cases.");
      return;
    }
    setSavingCase(true);
    setCaseError(null);
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeCase),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Failed to save case");
      }
      const saved = body?.caseRecord as CaseRecord;
      setCases((prev) => prev.map((item) => (item.id === activeCase.id ? saved : item)));
      setActiveCaseId(saved.id);
    } catch (error) {
      setCaseError((error as Error).message);
    } finally {
      setSavingCase(false);
    }
  };

  const handleDeleteCase = async () => {
    const current = activeCase;
    if (!current) return;
    if (!isSignedIn || current.id.startsWith("local-")) {
      const filtered = cases.filter((item) => item.id !== current.id);
      if (filtered.length === 0) {
        const fallback = createCase();
        setCases([fallback]);
        setActiveCaseId(fallback.id);
      } else {
        setCases(filtered);
        setActiveCaseId(filtered[0].id);
      }
      return;
    }
    setDeletingCaseId(current.id);
    setCaseError(null);
    try {
      const response = await fetch("/api/cases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Failed to delete case");
      }
      const filtered = cases.filter((item) => item.id !== current.id);
      if (filtered.length === 0) {
        const fallback = createCase();
        setCases([fallback]);
        setActiveCaseId(fallback.id);
      } else {
        setCases(filtered);
        setActiveCaseId(filtered[0].id);
      }
    } catch (error) {
      setCaseError((error as Error).message);
    } finally {
      setDeletingCaseId(null);
    }
  };

  if (!isLoaded || loadingCases) {
    return (
      <div className="rounded-4xl border border-border/70 bg-card/80 p-6 text-sm text-muted-foreground">
        Loading case studio…
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className="rounded-4xl border border-border/70 bg-card/80 p-6 text-sm text-muted-foreground">
        Unable to load case data.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-4xl border border-border/70 bg-card/80 p-6 shadow-xl shadow-black/15">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Career Professionals</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">Case Management Studio</h1>
              <p className="text-sm text-muted-foreground">
                Capture parties, desired outcomes, facts, evidence, and binding authority while staying connected to AI-powered legal research.
                Draft arguments, generate citations, and push matters into Legal Projects without leaving CCPROS.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={handleSaveCase}
                className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground shadow shadow-primary/40"
                disabled={savingCase}
              >
                {savingCase ? "Saving…" : "Save case"}
              </button>
              <button
                type="button"
                onClick={handleDeleteCase}
                className="rounded-full border border-border/70 px-4 py-2 text-foreground"
                disabled={deletingCaseId !== null}
              >
                {deletingCaseId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
          {caseError && <p className="text-sm text-destructive">{caseError}</p>}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard label="Active cases" value={cases.length.toString()} detail="Synced" icon={Briefcase} />
          <MetricCard label="Parties tracked" value={(activeCase.parties.length ?? 0).toString()} detail="Current case" icon={Scale} />
          <MetricCard label="Authority citations" value={(activeCase.lawReferences.length ?? 0).toString()} detail="Linked references" icon={Gavel} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <article className="rounded-3xl border border-border/70 bg-background/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Case files</p>
              <h2 className="text-xl font-semibold">Case roster</h2>
            </div>
            <button
              type="button"
              onClick={handleAddCase}
              className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground transition hover:bg-card"
            >
              + New case
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {cases.map((legalCase) => (
              <button
                key={legalCase.id}
                type="button"
                onClick={() => setActiveCaseId(legalCase.id)}
                className={
                  "w-full rounded-2xl border px-4 py-3 text-left text-sm transition " +
                  (activeCase.id === legalCase.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-card/70 hover:border-border")
                }
              >
                <span className="block font-semibold">{legalCase.title || "Untitled case"}</span>
                <span className="text-xs text-muted-foreground">
                  {legalCase.docket || "Docket pending"} · {legalCase.jurisdiction || "Jurisdiction TBD"}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-border/70 bg-background/80 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Integrations</p>
          <h2 className="text-xl font-semibold">Connect with Legal Projects</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Once a case strategy is finalized you can move the matter into the Legal Projects dashboard to collaborate with AI research, document drafting,
            and GPT-5 workflows. Saved answers, instructions, and citations flow between the two workspaces.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app/legal-projects"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow shadow-primary/40"
            >
              Open Legal Projects
              <ArrowRight className="ml-2 size-4" />
            </Link>
            <Link href="/app/ai-training" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm">
              AI Lab preview
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <div className="space-y-6">
          <CaseBasics caseRecord={activeCase} onChange={updateCase} />

          <article className="rounded-3xl border border-border/70 bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Parties</p>
                <h3 className="text-lg font-semibold">Roster</h3>
              </div>
              <span className="text-xs text-muted-foreground">{activeCase.parties.length} parties</span>
            </div>
            <form onSubmit={handleAddParty} className="mt-4 grid gap-2 sm:grid-cols-[1.5fr,0.8fr]">
              <input
                value={partyForm.name}
                onChange={(event) => setPartyForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Party name"
                className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={partyForm.role}
                  onChange={(event) => setPartyForm((prev) => ({ ...prev, role: event.target.value as Party["role"] }))}
                  className="w-32 rounded-2xl border border-border/60 bg-background/70 px-2 text-sm"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <input
                  value={partyForm.contact}
                  onChange={(event) => setPartyForm((prev) => ({ ...prev, contact: event.target.value }))}
                  placeholder="Contact"
                  className="flex-1 rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-2xl border border-border/60 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
              >
                Add party
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {activeCase.parties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parties captured yet.</p>
              ) : (
                activeCase.parties.map((party) => (
                  <div key={party.id} className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
                    <span className="font-semibold">{party.name}</span>
                    <span className="mx-2 text-muted-foreground">{party.role}</span>
                    <span className="text-xs text-muted-foreground">{party.contact || "Contact pending"}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-border/70 bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Witness prep</p>
                <h3 className="text-lg font-semibold">Witnesses & testimony</h3>
              </div>
              <span className="text-xs text-muted-foreground">{activeCase.witnesses.length} witnesses</span>
            </div>
            <form onSubmit={handleAddWitness} className="mt-4 space-y-2">
              <input
                value={witnessForm.name}
                onChange={(event) => setWitnessForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Witness name"
                className="w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
              />
              <textarea
                value={witnessForm.testimony}
                onChange={(event) => setWitnessForm((prev) => ({ ...prev, testimony: event.target.value }))}
                placeholder="Expected testimony / talking points"
                className="h-20 w-full rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
              />
              <input
                value={witnessForm.relevance}
                onChange={(event) => setWitnessForm((prev) => ({ ...prev, relevance: event.target.value }))}
                placeholder="Theme or issue addressed"
                className="w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
              />
              <button type="submit" className="w-full rounded-2xl border border-border/60 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                Add witness
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {activeCase.witnesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No witnesses captured yet.</p>
              ) : (
                activeCase.witnesses.map((witness) => (
                  <div key={witness.id} className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
                    <p className="font-semibold">{witness.name}</p>
                    <p className="text-xs text-muted-foreground">{witness.testimony || "Testimony pending"}</p>
                    <p className="text-[11px] text-muted-foreground">Relevance: {witness.relevance || ""}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-border/70 bg-card/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Facts & Evidence</p>
                <h3 className="text-lg font-semibold">Case workbook</h3>
              </div>
              <select
                value={entryType}
                onChange={(event) => setEntryType(event.target.value as NoteEntry["type"])}
                className="rounded-2xl border border-border/60 bg-background/70 px-2 py-1 text-xs"
              >
                {(["Note", "Fact", "Evidence"] as NoteEntry["type"][]).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={entryText}
              onChange={(event) => setEntryText(event.target.value)}
              placeholder="Add timeline facts, deposition summaries, or evidentiary notes."
              className="mt-3 h-32 w-full rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <input
                value={entryOwner}
                onChange={(event) => setEntryOwner(event.target.value)}
                className="rounded-2xl border border-border/60 bg-background/70 px-2 py-1"
                placeholder="Owner"
              />
              <button
                type="button"
                onClick={handleAddEntry}
                className="rounded-2xl border border-border/60 bg-primary/10 px-3 py-1 font-semibold text-primary"
              >
                Save entry
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {activeCase.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet—capture your first fact or evidence summary.</p>
              ) : (
                activeCase.entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border/50 bg-background/70 p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{entry.type}</span>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-foreground">{entry.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Owner: {entry.owner}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-3xl border border-border/70 bg-card/80 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Law + authority</p>
            <h3 className="text-lg font-semibold">Applicable law</h3>
            <form onSubmit={handleAddLawReference} className="mt-3 space-y-2">
              <div className="flex gap-2">
                <select
                  value={lawForm.kind}
                  onChange={(event) => setLawForm((prev) => ({ ...prev, kind: event.target.value as LawReference["kind"] }))}
                  className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                >
                  {LAW_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <input
                  value={lawForm.citation}
                  onChange={(event) => setLawForm((prev) => ({ ...prev, citation: event.target.value }))}
                  placeholder="Citation"
                  className="flex-1 rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                value={lawForm.summary}
                onChange={(event) => setLawForm((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Notes on how the statute/precedent applies to this case"
                className="h-24 w-full rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-2xl border border-border/60 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
              >
                Add reference
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {activeCase.lawReferences.length === 0 ? (
                <p className="text-sm text-muted-foreground">No authority recorded yet.</p>
              ) : (
                activeCase.lawReferences.map((reference) => (
                  <div key={reference.id} className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
                    <p className="font-semibold">
                      {reference.kind}: {reference.citation || "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">{reference.summary || "Summary pending"}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-primary/40 bg-primary/5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
                <Sparkles className="size-4" />
                <span>AI assistant</span>
              </div>
              <button
                type="button"
                onClick={handleGetSuggestions}
                className="rounded-full border border-primary/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary"
                disabled={suggestionsLoading}
              >
                {suggestionsLoading ? "Thinking…" : "Get recommendations"}
              </button>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-primary">Legal research copilot</h3>
            <form onSubmit={handleAiResearch} className="mt-3 space-y-3">
              <input
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                className="w-full rounded-2xl border border-primary/40 bg-background/80 px-3 py-2 text-sm"
                placeholder="Ask about statutes, precedent, or strategy"
              />
              <textarea
                value={aiInstructions}
                onChange={(event) => setAiInstructions(event.target.value)}
                className="h-24 w-full rounded-2xl border border-primary/40 bg-background/80 p-3 text-sm"
                placeholder="Add instructions or party posture"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow shadow-primary/30"
                disabled={aiLoading}
              >
                {aiLoading ? "Running research…" : "Ask CCPROS AI"}
              </button>
            </form>
            {aiError ? <p className="mt-2 text-sm text-destructive">{aiError}</p> : null}
            {aiAnswer && (
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border border-primary/40 bg-background/80 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI summary</p>
                  <p className="mt-2 whitespace-pre-line">{aiAnswer}</p>
                </div>
                {aiCitations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Citations</p>
                    {aiCitations.map((citation) => (
                      <div key={citation.document_id} className="rounded-2xl border border-border/60 bg-background/80 p-3 text-xs">
                        <p className="font-semibold">{citation.title}</p>
                        <p className="text-muted-foreground">{citation.excerpt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <RecommendationPanel
              suggestions={suggestions}
              citations={suggestionCitations}
              warnings={suggestionWarnings}
              error={suggestionError}
              onAccept={applySuggestion}
              onDismiss={(suggestion) => setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id))}
            />
          </article>
        </div>
      </section>
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: typeof Briefcase;
};

function MetricCard({ label, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-border/70 bg-background/80 p-4">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

type CaseBasicsProps = {
  caseRecord: CaseRecord;
  onChange: (partial: Partial<CaseRecord>) => void;
};

function CaseBasics({ caseRecord, onChange }: CaseBasicsProps) {
  return (
    <article className="rounded-3xl border border-border/70 bg-card/80 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        <FileText className="size-4" />
        <span>Case overview</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          value={caseRecord.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
          placeholder="Case title"
        />
        <input
          value={caseRecord.docket}
          onChange={(event) => onChange({ docket: event.target.value })}
          className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
          placeholder="Docket / file number"
        />
        <input
          value={caseRecord.jurisdiction}
          onChange={(event) => onChange({ jurisdiction: event.target.value })}
          className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
          placeholder="Jurisdiction"
        />
        <textarea
          value={caseRecord.desiredOutcome}
          onChange={(event) => onChange({ desiredOutcome: event.target.value })}
          className="h-24 w-full rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
          placeholder="Desired outcomes or remedies"
        />
      </div>
    </article>
  );
}

type RecommendationPanelProps = {
  suggestions: CaseSuggestion[];
  citations: string[];
  warnings: string[];
  error: string | null;
  onAccept: (suggestion: CaseSuggestion) => void;
  onDismiss: (suggestion: CaseSuggestion) => void;
};

function RecommendationPanel({ suggestions, citations, warnings, error, onAccept, onDismiss }: RecommendationPanelProps) {
  if (!suggestions.length && !error && !warnings.length && !citations.length) {
    return null;
  }
  return (
    <div className="mt-5 space-y-3 text-sm">
      {error ? <p className="text-destructive">{error}</p> : null}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI recommendations</p>
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-2xl border border-primary/30 bg-background/90 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{suggestion.category}</p>
                  <p className="font-semibold">{suggestion.title}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.detail}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    onClick={() => onAccept(suggestion)}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-border/60 px-3 py-1 text-xs"
                    onClick={() => onDismiss(suggestion)}
                  >
                    Ignore
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1 text-xs text-amber-500">
          <p className="uppercase tracking-[0.3em]">Warnings</p>
          {warnings.map((warning, index) => (
            <p key={`warning-${index}`}>{warning}</p>
          ))}
        </div>
      )}
      {citations.length > 0 && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="uppercase tracking-[0.3em]">Sources referenced</p>
          {citations.map((cite, index) => (
            <p key={`cite-${index}`}>• {cite}</p>
          ))}
        </div>
      )}
    </div>
  );
}
