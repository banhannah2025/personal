import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { openaiClient } from "@/lib/aiClients";

type Party = {
  id: string;
  name: string;
  role: string;
  contact: string;
};

type NoteEntry = {
  id: string;
  type: string;
  content: string;
  owner: string;
  createdAt: string;
};

type LawReference = {
  id: string;
  kind: string;
  citation: string;
  summary: string;
};

type CaseRecord = {
  title: string;
  docket: string;
  jurisdiction: string;
  desiredOutcome: string;
  parties: Party[];
  witnesses: Array<{ name: string; testimony: string; relevance: string }>;
  entries: NoteEntry[];
  lawReferences: LawReference[];
};

type Suggestion = {
  id: string;
  category: string;
  title: string;
  detail: string;
};

const COURTLISTENER_API = "https://www.courtlistener.com/api/rest/v3/search/";

async function ensureUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("unauthorized");
  }
  return user;
}

async function fetchCourtListenerContext(query: string) {
  if (!query) return [] as { cite: string; snippet: string }[];
  try {
    const url = new URL(COURTLISTENER_API);
    url.searchParams.set("q", query);
    url.searchParams.set("order_by", "score desc");
    url.searchParams.set("page_size", "3");
    const headers: Record<string, string> = { "User-Agent": "ccpros-case-manager" };
    const token = process.env.COURTLISTENER_API_TOKEN;
    if (token) {
      headers.Authorization = `Token ${token}`;
    }
    const response = await fetch(url.toString(), { headers, next: { revalidate: 60 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { results?: Array<{ cite?: string; plain_text?: string }> };
    return (data.results ?? [])
      .slice(0, 3)
      .map((result) => ({ cite: result.cite ?? "Unknown cite", snippet: (result.plain_text ?? "").slice(0, 1000) }));
  } catch (error) {
    console.error("courtlistener fetch", error);
    return [];
  }
}

function buildCaseSummary(payload: CaseRecord) {
  const partySummary = payload.parties.map((party) => `${party.role}: ${party.name}`).join("; ");
  const witnessSummary = (payload.witnesses ?? []).map((witness) => `${witness.name} -> ${witness.testimony}`).join("\n");
  const factSummary = payload.entries.map((entry) => `${entry.type}: ${entry.content}`).slice(0, 10).join("\n");
  const lawSummary = payload.lawReferences.map((law) => `${law.kind}: ${law.citation} -> ${law.summary}`).join("\n");
  return `Title: ${payload.title}
Docket: ${payload.docket}
Jurisdiction: ${payload.jurisdiction}
Desired outcome: ${payload.desiredOutcome}
Parties: ${partySummary}
Witnesses:
${witnessSummary}
Facts/Evidence:
${factSummary}
Existing authority:
${lawSummary}`;
}

export async function POST(request: Request) {
  try {
    await ensureUser();
    if (!openaiClient) {
      return NextResponse.json({ error: "OpenAI client missing" }, { status: 500 });
    }
    let payload: { caseRecord?: CaseRecord };
    try {
      payload = (await request.json()) as { caseRecord?: CaseRecord };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!payload.caseRecord) {
      return NextResponse.json({ error: "caseRecord is required" }, { status: 400 });
    }

    const caseSummary = buildCaseSummary(payload.caseRecord);
    const courtListenerContext = await fetchCourtListenerContext(
      payload.caseRecord.title || payload.caseRecord.desiredOutcome
    );

    const systemPrompt = `You are CCPROS's AI legal strategist. Provide practical, plain-language suggestions for building a case file.
Return JSON with this shape:
{
  "suggestions": [
    {"category": "party|outcome|fact|evidence|law|note|witness", "title": "...", "detail": "..."}
  ],
  "citations": ["..."],
  "warnings": ["..."]
}
Categories:
- party: recommend new parties or roles to capture.
- outcome: clarify remedies or relief.
- fact: factual investigations or timelines.
- evidence: exhibits or discovery tasks.
- law: statutes, precedent, or constitutional factors.
- witness: deponents or trial witnesses plus testimony summary.
- note: general reminders.
Reference real authority when possible using the CourtListener snippets provided.`;

    const courtListenerPrompt = courtListenerContext
      .map((item, index) => `CourtListener Source ${index + 1}: ${item.cite}\n${item.snippet}`)
      .join("\n\n");

    const completion = await openaiClient.responses.create({
      model: "gpt-5.1",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Case summary:\n${caseSummary}\n\nCourtListener snippets:\n${courtListenerPrompt || "None"}`,
        },
      ],
      max_output_tokens: 1200,
    });

    type OutputText = { type: "output_text"; text: string };
    type OutputMessage = { type: "message"; content: OutputText[] };
    type SafeOutput = OutputText | OutputMessage | undefined;

    const firstOutput = completion.output?.[0] as SafeOutput;
    const raw =
      (firstOutput?.type === "message"
        ? firstOutput.content.find((part) => part.type === "output_text")?.text
        : firstOutput?.type === "output_text"
        ? firstOutput.text
        : null) ?? "{}";
    let parsed: { suggestions?: Suggestion[]; citations?: string[]; warnings?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { suggestions: [] };
    }
    return NextResponse.json({
      suggestions: parsed.suggestions ?? [],
      citations: parsed.citations ?? courtListenerContext.map((item) => item.cite),
      warnings: parsed.warnings ?? [],
    });
  } catch (error) {
    if ((error as Error).message === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("case-ai POST", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
