"use client";

import { FormEvent, useState } from "react";
import RepoExplorer from "@/components/RepoExplorer";
import AssistantConsole from "@/components/AssistantConsole";
import { useAuth, useUser } from "@clerk/nextjs";
import { isAdminFromMetadata } from "@/lib/roles";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export default function AdminDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const isAdmin = isSignedIn && !!user && isAdminFromMetadata(user.publicMetadata, email);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        Please sign in with your admin account to access the toolkit.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/80 p-8 text-center text-sm text-muted-foreground">
        Your account does not have admin access. Contact the CCPROS team if this is unexpected.
      </div>
    );
  }

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Ask a question or describe the knowledge you need.");
      return;
    }
    setLoading(true);
    setError(null);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [userMessage, ...prev]);
    setPrompt("");
    try {
      const response = await fetch("/api/admin-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmed,
          history: [
            ...messages
              .slice(0, 6)
              .reverse()
              .map((entry) => ({ role: entry.role, content: entry.content })),
            { role: "user" as const, content: trimmed },
          ],
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Chat assistant failed");
      }
      const data = (await response.json()) as { reply: string; model: string };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [assistantMessage, ...prev]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Chat assistant failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin Toolkit</p>
        <h1 className="text-4xl font-semibold tracking-tight">Operations, code, and AI research</h1>
        <p className="text-muted-foreground">
          A private dashboard for trusted operators. Manage code via the workbench and tap GPT-5 for
          institutional knowledge until authentication ships.
        </p>
      </header>

      <section className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">GPT-5 Admin Chatbot</h2>
            <p className="text-sm text-muted-foreground">
              Ask for research briefs, policy summaries, or internal checklists. Responses are
              grounded in your prompts until deeper data connections arrive.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Knowledge partner</span>
        </div>
        <form onSubmit={handleChatSubmit} className="mt-4 space-y-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-[120px] w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="Outline our onboarding policy updates..."
            disabled={loading}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Consulting GPT-5…" : "Send"}
            </button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="text-xs text-muted-foreground">
              Uses gpt-5.1-chat-latest via OpenAI. History limited onsite for privacy.
            </p>
          </div>
        </form>
        <div className="mt-6 space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admin chats yet. Ask for context or paste research to start building institutional
              memory.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className="rounded-2xl border border-border/40 bg-background/70 p-4 text-sm"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-[0.2em]">{message.role}</span>
                  <span>{new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-foreground">{message.content}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-border/80 bg-card/80 p-6 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Code Manager</h2>
            <p className="text-sm text-muted-foreground">
              Explore the repo and collaborate with Codex before deploying updates.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI Workbench</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <RepoExplorer />
          <AssistantConsole />
        </div>
      </section>
    </div>
  );
}
