import { supabaseAdminClient } from "@/lib/supabase";
import { groqClient, openaiClient, DEFAULT_COMPLETION_MODEL, DEFAULT_GROQ_MODEL } from "@/lib/aiClients";
import { embedQuery, retrieveChunks, type RetrievedChunk } from "@/lib/rag";

type RunTrainingInput = {
  sessionId: string;
  promptTemplateId: string;
  query: string;
  domain: "legal" | "academic";
  additionalFacts?: string;
  reasoningLevel?: number;
};

export type TrainingRunResult = {
  runId: string;
  documentId: string;
  content: string;
  retrieval: RetrievedChunk[];
};

function formatContext(chunks: RetrievedChunk[]) {
  return chunks
    .map((chunk, index) => {
      const label = `Source ${index + 1}: ${chunk.document_title || "Untitled"}`;
      return `${label}\nScore: ${chunk.score.toFixed(3)}\n${chunk.content.trim()}`;
    })
    .join("\n\n");
}

export async function runTrainingPipeline(input: RunTrainingInput): Promise<TrainingRunResult> {
  if (!supabaseAdminClient) {
    throw new Error("Supabase admin client not configured.");
  }
  if (!openaiClient) {
    throw new Error("OpenAI client not configured.");
  }
  if (!groqClient) {
    throw new Error("Groq client not configured.");
  }

  const { data: session, error: sessionError } = await supabaseAdminClient
    .from("training_sessions")
    .select("id, domain, title, objective, status")
    .eq("id", input.sessionId)
    .single();
  if (sessionError || !session) {
    throw new Error("Training session not found.");
  }

  const { data: promptTemplate, error: promptError } = await supabaseAdminClient
    .from("prompt_templates")
    .select("id, name, instructions, template_kind, domain")
    .eq("id", input.promptTemplateId)
    .single();
  if (promptError || !promptTemplate) {
    throw new Error("Prompt template not found.");
  }

  await supabaseAdminClient
    .from("training_sessions")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", session.id);

  const embedding = await embedQuery(input.query);
  const retrieved = await retrieveChunks(supabaseAdminClient, embedding, {
    domain: input.domain,
    matchCount: 6,
  });

  const context = formatContext(retrieved);

  const groqSummaryResponse = await groqClient.chat.completions.create({
    model: DEFAULT_GROQ_MODEL,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "You are a high-speed analyst. Summarize retrieved legal or academic passages into bullet points that preserve citations and procedural posture. Flag conflicting rules.",
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuery: ${input.query}`,
      },
    ],
  });

  const groqSummary = groqSummaryResponse.choices[0]?.message?.content ?? "";

  const finalPrompt = [
    `PROMPT TEMPLATE INSTRUCTIONS:\n${promptTemplate.instructions}`,
    `SESSION TITLE: ${session.title}`,
    `SESSION OBJECTIVE: ${session.objective ?? "N/A"}`,
    `TRAINING QUERY: ${input.query}`,
    `ADDITIONAL FACTS: ${input.additionalFacts ?? "None provided"}`,
    `RETRIEVED CONTEXT:\n${context}`,
    `GROQ SYNTHESIS:\n${groqSummary}`,
    `RESPONSE FORMAT: Provide structured analysis with numbered citations referencing Source numbers.`,
  ].join("\n\n");

  const completion = await openaiClient.responses.create({
    model: DEFAULT_COMPLETION_MODEL,
    reasoning: input.reasoningLevel
      ? {
          effort: input.reasoningLevel > 1 ? "medium" : "low",
        }
      : undefined,
    input: [
      {
        role: "system",
        content:
          "You are a dual-domain expert (legal + academic). Provide rigorous analysis, maintain citations, and flag uncertainties. If sources conflict, explain both interpretations.",
      },
      {
        role: "user",
        content: finalPrompt,
      },
    ],
    max_output_tokens: 2000,
  });

  type OutputText = { type: "output_text"; text: string };
  type OutputMessage = { type: "message"; content: OutputText[] };
  const firstOutput = completion.output?.[0] as OutputText | OutputMessage | undefined;
  const generatedText =
    (firstOutput?.type === "message"
      ? firstOutput.content.find((part) => part.type === "output_text")?.text
      : firstOutput?.type === "output_text"
      ? firstOutput.text
      : null) ?? JSON.stringify(completion.output);

  const { data: runRecord, error: runError } = await supabaseAdminClient
    .from("session_runs")
    .insert({
      session_id: session.id,
      model_name: DEFAULT_COMPLETION_MODEL,
      prompt_template_id: promptTemplate.id,
      input_payload: {
        query: input.query,
        additionalFacts: input.additionalFacts,
        groqModel: DEFAULT_GROQ_MODEL,
      },
      output_summary: generatedText.slice(0, 400),
      output_tokens: completion.usage?.output_tokens ?? null,
    })
    .select("id")
    .single();

  if (runError || !runRecord) {
    throw new Error("Failed to record training run.");
  }

  const { data: generatedDocument, error: documentError } = await supabaseAdminClient
    .from("generated_documents")
    .insert({
      session_id: session.id,
      draft_template_id: null,
      domain: session.domain,
      title: `${session.title} – ${new Date().toLocaleDateString()}`,
      doc_type: promptTemplate.template_kind,
      content: generatedText,
      status: "draft",
      validation_status: "unverified",
    })
    .select("id")
    .single();

  if (documentError || !generatedDocument) {
    throw new Error("Failed to save generated document.");
  }

  if (retrieved.length) {
    const citations = retrieved.map((chunk, index) => ({
      generated_document_id: generatedDocument.id,
      chunk_id: chunk.chunk_id,
      citation_label: `Source ${index + 1}`,
      excerpt: chunk.content.slice(0, 400),
    }));
    await supabaseAdminClient.from("source_citations").insert(citations);
  }

  await supabaseAdminClient
    .from("training_sessions")
    .update({
      status: "needs_input",
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return {
    runId: runRecord.id,
    documentId: generatedDocument.id,
    content: generatedText,
    retrieval: retrieved,
  };
}
