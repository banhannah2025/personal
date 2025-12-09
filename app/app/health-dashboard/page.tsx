"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

type HouseholdMember = {
  id: number;
  name: string;
  age: string;
  healthNotes: string;
};

type BudgetPlan = {
  id: number;
  category: string;
  monthly: number;
};

type HealthJournalEntry = {
  id: number;
  mood: string;
  energy: string;
  concerns: string;
  goalsImpact: string;
  createdAt: string;
};

type PlanOption = {
  id: string;
  cadence: "Weekly" | "Monthly";
  title: string;
  summary: string;
  actions: string[];
};

type HealthCitation = {
  source: string;
  title: string;
  excerpt: string;
};

const moods = ["Strong", "Steady", "Tender", "Foggy", "Sore"] as const;
const energyLevels = ["High", "Balanced", "Low"] as const;

export default function HealthDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [householdSize, setHouseholdSize] = useState("");
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [memberForm, setMemberForm] = useState({
    name: "",
    age: "",
    healthNotes: "",
  });
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editingMemberForm, setEditingMemberForm] = useState({
    name: "",
    age: "",
    healthNotes: "",
  });

  const [medicalHistory, setMedicalHistory] = useState("");
  const [healthGoals, setHealthGoals] = useState("");

  const [budget, setBudget] = useState<BudgetPlan[]>([]);
  const [budgetForm, setBudgetForm] = useState({ category: "", monthly: "" });

  const [journalEntries, setJournalEntries] = useState<HealthJournalEntry[]>([]);
  const [journalForm, setJournalForm] = useState({
    mood: moods[0],
    energy: energyLevels[1],
    concerns: "",
    goalsImpact: "",
  });

  const householdSummary = useMemo(() => {
    const ages = members.map((member) => member.age).filter(Boolean).join(", ");
    return `${members.length} member(s)${ages ? ` · Ages ${ages}` : ""}`;
  }, [members]);

  const totalBudget = useMemo(
    () => budget.reduce((sum, line) => sum + line.monthly, 0),
    [budget]
  );

  const perPersonBudget = useMemo(() => {
    const baseline = Number(householdSize) || members.length || 1;
    return totalBudget / Math.max(baseline, 1);
  }, [householdSize, members.length, totalBudget]);

  const handleAddMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberForm.name.trim()) {
      return;
    }
    const newMember: HouseholdMember = {
      id: Date.now(),
      name: memberForm.name.trim(),
      age: memberForm.age.trim(),
      healthNotes: memberForm.healthNotes.trim(),
    };
    const updatedMembers = [...members, newMember];
    setMembers(updatedMembers);
    void refreshAiRecommendations({ members: updatedMembers });
    setMemberForm({ name: "", age: "", healthNotes: "" });
  };

  const handleAddBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!budgetForm.category.trim()) {
      return;
    }
    const newLine: BudgetPlan = {
      id: Date.now(),
      category: budgetForm.category.trim(),
      monthly: Number(budgetForm.monthly) || 0,
    };
    const updatedBudget = [...budget, newLine];
    setBudget(updatedBudget);
    void refreshAiRecommendations({ budget: updatedBudget });
    setBudgetForm({ category: "", monthly: "" });
  };

  const handleAddJournal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!journalForm.concerns.trim()) {
      return;
    }
    const newEntry: HealthJournalEntry = {
      id: Date.now(),
      mood: journalForm.mood,
      energy: journalForm.energy,
      concerns: journalForm.concerns.trim(),
      goalsImpact: journalForm.goalsImpact.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedEntries = [newEntry, ...journalEntries];
    setJournalEntries(updatedEntries);
    void refreshAiRecommendations({ journalEntries: updatedEntries });
    setJournalForm((prevState) => ({ ...prevState, concerns: "", goalsImpact: "" }));
  };

  const beginEditingMember = (member: HouseholdMember) => {
    setEditingMemberId(member.id);
    setEditingMemberForm({
      name: member.name,
      age: member.age,
      healthNotes: member.healthNotes,
    });
  };

  const cancelEditingMember = () => {
    setEditingMemberId(null);
    setEditingMemberForm({ name: "", age: "", healthNotes: "" });
  };

  const handleUpdateMember = (event: FormEvent<HTMLFormElement>, memberId: number) => {
    event.preventDefault();
    if (!editingMemberForm.name.trim()) {
      return;
    }
    setMembers((prevMembers) => {
      const updatedMembers = prevMembers.map((member) =>
        member.id === memberId
          ? {
              ...member,
              name: editingMemberForm.name.trim(),
              age: editingMemberForm.age.trim(),
              healthNotes: editingMemberForm.healthNotes.trim(),
            }
          : member
      );
      void refreshAiRecommendations({ members: updatedMembers });
      return updatedMembers;
    });
    cancelEditingMember();
  };

  const handleRemoveMember = (memberId: number) => {
    setMembers((prevMembers) => {
      const updatedMembers = prevMembers.filter((member) => member.id !== memberId);
      void refreshAiRecommendations({ members: updatedMembers });
      return updatedMembers;
    });
    if (editingMemberId === memberId) {
      cancelEditingMember();
    }
  };

  const hasPlanInputs = useMemo(
    () =>
      members.length > 0 &&
      budget.length > 0 &&
      journalEntries.length > 0 &&
      medicalHistory.trim().length > 0 &&
      healthGoals.trim().length > 0,
    [members.length, budget.length, journalEntries.length, medicalHistory, healthGoals]
  );

  const planOptions = useMemo<PlanOption[]>(() => {
    if (!hasPlanInputs) {
      return [];
    }
    const latestEntry = journalEntries[0];
    const vibe = latestEntry?.mood ?? "Steady";
    const concern = latestEntry?.concerns ?? "Add a journal entry";
    const cadenceFocus = healthGoals || "Define clear outcomes";
    const medFocus = medicalHistory || "Share history";
    const perPerson = perPersonBudget || totalBudget;

    return [
      {
        id: "weekly-ritual",
        cadence: "Weekly",
        title: "Weekly anti-inflammatory ritual",
        summary: `Budget about $${perPerson.toFixed(2)} per person. Honor mood "${vibe}" and concern "${concern}" with lighter dinners + mobility reminders.`,
        actions: [
          "Prep 3 dinners with omega-3 + leafy greens",
          "Schedule strength/mobility blocks in Life Dashboard calendar",
          "Share grocery list and journal change log with the assistant",
        ],
      },
      {
        id: "monthly-reset",
        cadence: "Monthly",
        title: "Monthly wellness reset",
        summary: `Use household goals (${cadenceFocus}) and medical history cues (${medFocus}) to run a 4-week experiment.`,
        actions: [
          "Allocate 10% of budget to new staples or supplements",
          "Book medical or therapy check-ins via calendar tasks",
          "Review journals with AI and adjust the next month's focus",
        ],
      },
    ];
  }, [hasPlanInputs, journalEntries, perPersonBudget, totalBudget, healthGoals, medicalHistory]);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<
    Array<{ title: string; detail: string }>
  >([]);
  const [aiCitations, setAiCitations] = useState<HealthCitation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsightError, setAiInsightError] = useState<string | null>(null);

  type AiOverride = {
    members?: HouseholdMember[];
    budget?: BudgetPlan[];
    journalEntries?: HealthJournalEntry[];
    medicalHistory?: string;
    healthGoals?: string;
  };

  const refreshAiRecommendations = useCallback(
    async (override?: AiOverride) => {
      if (!isSignedIn) return;
      setAiLoading(true);
      setAiInsightError(null);
      const effectiveMembers = override?.members ?? members;
      const effectiveBudget = override?.budget ?? budget;
      const effectiveJournalEntries = override?.journalEntries ?? journalEntries;
      const effectiveMedicalHistory = override?.medicalHistory ?? medicalHistory;
      const effectiveHealthGoals = override?.healthGoals ?? healthGoals;
      try {
        const response = await fetch("/api/health-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            members: effectiveMembers.map((member) => ({
              name: member.name,
              age: member.age,
              healthNotes: member.healthNotes,
            })),
            budget: effectiveBudget.map((line) => ({
              category: line.category,
              monthly: line.monthly,
            })),
            medicalHistory: effectiveMedicalHistory,
            healthGoals: effectiveHealthGoals,
            latestJournal: effectiveJournalEntries[0]
              ? {
                  mood: effectiveJournalEntries[0].mood,
                  energy: effectiveJournalEntries[0].energy,
                  concerns:
                    effectiveJournalEntries[0].concerns ||
                    effectiveJournalEntries[0].goalsImpact ||
                    "",
                  goalsImpact: effectiveJournalEntries[0].goalsImpact ?? "",
                }
              : undefined,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "Unable to fetch AI insights");
        }
        const data = (await response.json()) as {
          summary: string;
          recommendations: Array<{ title: string; detail: string }>;
          citations?: HealthCitation[];
        };
        setAiSummary(data.summary);
        setAiRecommendations(data.recommendations);
        setAiCitations(data.citations ?? []);
      } catch (error) {
        console.error(error);
        setAiInsightError(error instanceof Error ? error.message : "Failed to refresh insights");
        setAiCitations([]);
      } finally {
        setAiLoading(false);
      }
    },
    [isSignedIn, members, budget, medicalHistory, healthGoals, journalEntries]
  );

  const initialInsightsLoaded = useRef(false);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || initialInsightsLoaded.current) {
      return;
    }
    initialInsightsLoaded.current = true;
    void refreshAiRecommendations();
  }, [isLoaded, isSignedIn, refreshAiRecommendations]);

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
        Please sign in to access the Health dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Health Systems
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Household wellness + meal planning blueprint
        </h1>
        <p className="text-muted-foreground">
          Capture household context, budgets, and health signals so AI can deliver collaborative
          weekly and monthly plans that sync with your Life Dashboard calendar.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5 lg:col-span-2">
          <h2 className="text-2xl font-semibold">Household Overview</h2>
          <p className="text-sm text-muted-foreground">
            Document who the plan supports, medical considerations, and shared goals.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Household size
              </label>
              <input
                value={householdSize}
                onChange={(event) => setHouseholdSize(event.target.value)}
                type="number"
                min="1"
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Medical history focus
              </label>
              <textarea
                value={medicalHistory}
                onChange={(event) => setMedicalHistory(event.target.value)}
                className="min-h-[120px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Household health goals
            </label>
            <textarea
              value={healthGoals}
              onChange={(event) => setHealthGoals(event.target.value)}
              className="min-h-[100px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <form onSubmit={handleAddMember} className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Name
              </label>
              <input
                value={memberForm.name}
                onChange={(event) =>
                  setMemberForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="e.g. Alex"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Age
              </label>
              <input
                value={memberForm.age}
                onChange={(event) =>
                  setMemberForm((prev) => ({ ...prev, age: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="35"
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-3">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Health notes
              </label>
              <textarea
                value={memberForm.healthNotes}
                onChange={(event) =>
                  setMemberForm((prev) => ({ ...prev, healthNotes: event.target.value }))
                }
                className="min-h-[80px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Allergies, medications, personal goals..."
              />
            </div>
            <button
              type="submit"
              className="md:col-span-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Add household member
            </button>
          </form>
          <div className="mt-6 space-y-3">
            {members.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/50 bg-background/50 p-4 text-sm text-muted-foreground">
                Add your first household member to unlock tailored AI context.
              </p>
            ) : (
              members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-border/40 bg-background/70 p-4"
                >
                  {editingMemberId === member.id ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => handleUpdateMember(event, member.id)}
                    >
                      <div className="flex flex-col gap-1">
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Name
                        </label>
                        <input
                          value={editingMemberForm.name}
                          onChange={(event) =>
                            setEditingMemberForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                          className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Age
                        </label>
                        <input
                          value={editingMemberForm.age}
                          onChange={(event) =>
                            setEditingMemberForm((prev) => ({ ...prev, age: event.target.value }))
                          }
                          className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Health notes
                        </label>
                        <textarea
                          value={editingMemberForm.healthNotes}
                          onChange={(event) =>
                            setEditingMemberForm((prev) => ({
                              ...prev,
                              healthNotes: event.target.value,
                            }))
                          }
                          className="min-h-[80px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingMember}
                          className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <h3 className="font-semibold">{member.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {member.age ? `Age ${member.age}` : "Age pending"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.healthNotes || "Add notes"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
                        <button
                          type="button"
                          onClick={() => beginEditingMember(member)}
                          className="rounded-full border border-border px-3 py-1 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="rounded-full border border-destructive/40 px-3 py-1 font-semibold text-destructive"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">Health Budget</h2>
          <p className="text-sm text-muted-foreground">
            Outline monthly resources so AI respects real-world constraints.
          </p>
          <form onSubmit={handleAddBudget} className="mt-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Category
              </label>
              <input
                value={budgetForm.category}
                onChange={(event) =>
                  setBudgetForm((prev) => ({ ...prev, category: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Groceries, therapy, gym..."
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Monthly budget ($)
              </label>
              <input
                value={budgetForm.monthly}
                onChange={(event) =>
                  setBudgetForm((prev) => ({ ...prev, monthly: event.target.value }))
                }
                type="number"
                min="0"
                step="0.01"
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="250"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Save budget line
            </button>
          </form>
          <div className="mt-6 space-y-3">
            {budget.map((line) => (
              <article
                key={line.id}
                className="rounded-2xl border border-border/40 bg-background/70 p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <h3 className="font-semibold">{line.category}</h3>
                  <span className="text-xs text-muted-foreground">
                    ${line.monthly.toFixed(2)} / month
                  </span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
            Total available: ${totalBudget.toFixed(2)} / month · ${perPersonBudget.toFixed(2)} per person
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5 lg:col-span-2">
          <h2 className="text-2xl font-semibold">Health Journal & Check-ins</h2>
          <p className="text-sm text-muted-foreground">
            Capture how the household feels so AI can adapt meal, movement, and recovery plans.
          </p>
          <form onSubmit={handleAddJournal} className="mt-4 grid gap-3 md:grid-cols-2">
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
                {moods.map((mood) => (
                  <option key={mood} value={mood}>
                    {mood}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Energy
              </label>
              <select
                value={journalForm.energy}
                onChange={(event) =>
                  setJournalForm((prev) => ({ ...prev, energy: event.target.value }))
                }
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {energyLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Concerns / symptoms today
              </label>
              <textarea
                value={journalForm.concerns}
                onChange={(event) =>
                  setJournalForm((prev) => ({ ...prev, concerns: event.target.value }))
                }
                className="min-h-[120px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Describe pain, digestion, stress, etc."
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Impact on goals
              </label>
              <textarea
                value={journalForm.goalsImpact}
                onChange={(event) =>
                  setJournalForm((prev) => ({ ...prev, goalsImpact: event.target.value }))
                }
                className="min-h-[100px] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Note where you need AI adjustments or accountability"
              />
            </div>
            <button
              type="submit"
              className="md:col-span-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Log health entry
            </button>
          </form>
          <div className="mt-6 space-y-4">
            {journalEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-border/30 bg-background/60 p-4"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-[0.2em]">
                    {entry.mood} · {entry.energy}
                  </span>
                  <span>
                    {new Date(entry.createdAt).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{entry.concerns}</p>
                {entry.goalsImpact && (
                  <p className="text-xs text-muted-foreground">Goal note: {entry.goalsImpact}</p>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h2 className="text-2xl font-semibold">AI Guidance Panel</h2>
          <p className="text-sm text-muted-foreground">
            Give the assistant holistic context for personalized plans.
          </p>
          <div className="mt-4 space-y-4">
            <article className="rounded-2xl border border-border/40 bg-background/70 p-4 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Household summary
              </p>
              <p className="mt-2">{householdSummary}</p>
              <p className="text-xs">Latest mood: {journalEntries[0]?.mood ?? "N/A"}</p>
            </article>
            <article className="rounded-2xl border border-border/40 bg-background/70 p-4 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Medical + goals
              </p>
              <p className="mt-2">{medicalHistory}</p>
              <p className="text-xs">Goals: {healthGoals}</p>
            </article>
            <article className="rounded-2xl border border-border/40 bg-background/70 p-4 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Budget reference
              </p>
              <p className="mt-2">${totalBudget.toFixed(2)} total / ${perPersonBudget.toFixed(2)} per person</p>
              <p className="text-xs">Hand this to the assistant before asking for meal plans.</p>
            </article>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
            Tip: once AI responds, copy recommended routines into the Life Dashboard calendar so
            reminders and tasks stay synchronized.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Plan Recommendation Studio</h2>
            <p className="text-sm text-muted-foreground">
              Weekly and monthly options the assistant can co-refine with you.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {aiSummary ??
                "Log household members, budget lines, and a health journal entry to unlock summary insights."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {aiInsightError ? (
              <p className="text-xs text-destructive">{aiInsightError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => refreshAiRecommendations()}
              disabled={aiLoading}
              className="rounded-full border border-primary/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {aiLoading ? "Updating…" : "Refresh AI"}
            </button>
          </div>
        </div>
        {planOptions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {planOptions.map((option) => (
              <article
                key={option.id}
                className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {option.cadence}
                    </p>
                    <h3 className="text-xl font-semibold">{option.title}</h3>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-primary/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-primary/10"
                  >
                    Send to calendar
                  </button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{option.summary}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {option.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      {action}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-border/50 bg-card/50 p-6 text-sm text-muted-foreground">
            Once you&rsquo;ve logged members, budgets, and journals, the assistant will draft weekly and monthly plan cards here.
          </p>
        )}
        <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
          <h3 className="text-xl font-semibold">AI Recommendations</h3>
          <p className="text-sm text-muted-foreground">
            Synthesized from your latest members, budget, and journal entries.
          </p>
          {aiRecommendations.length > 0 ? (
            <div className="mt-4 space-y-3">
              {aiRecommendations.map((rec) => (
                <article
                  key={rec.title}
                  className="rounded-2xl border border-border/50 bg-background/70 p-4 text-sm"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {rec.title}
                  </p>
                  <p className="mt-2 text-muted-foreground">{rec.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-border/50 bg-background/50 p-4 text-xs text-muted-foreground">
              Add data across the dashboard and hit “Refresh AI” to see recommendations appear here.
            </p>
          )}
        </div>
        {aiCitations.length ? (
          <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg shadow-black/5">
            <h3 className="text-xl font-semibold">Academic references consulted</h3>
            <p className="text-sm text-muted-foreground">
              Pulled from your academic AI training corpora to back each recommendation.
            </p>
            <div className="mt-4 space-y-3">
              {aiCitations.map((citation) => (
                <article
                  key={`${citation.source}-${citation.title}`}
                  className="rounded-2xl border border-border/50 bg-background/70 p-4 text-sm"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {citation.source}
                  </p>
                  <p className="mt-1 font-semibold text-foreground">{citation.title}</p>
                  <p className="mt-2 text-muted-foreground">{citation.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Future idea: once the coding AI has access, push selected plan cards directly into the Life
          Dashboard calendar tasks and reminders.
        </div>
      </section>
    </div>
  );
}
