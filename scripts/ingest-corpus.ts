#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DomainType = "legal" | "academic";

type CorpusRow = {
  id: string;
  domain: DomainType;
  name: string;
  description: string | null;
  source_type: string;
  access_level: string;
  default_chunk_size: number | null;
  metadata: {
    folder?: string;
    preferred_format?: string[];
    [key: string]: unknown;
  } | null;
};

type DocumentSidecar = {
  title?: string;
  doc_type?: string;
  jurisdiction?: string;
  discipline?: string;
  source_url?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  metadata?: Record<string, unknown>;
};

type CliOptions = {
  domain?: DomainType;
  name?: string;
  dryRun?: boolean;
};

const supportedExtensions = new Set([".txt", ".md", ".pdf", ".html", ".htm"]);
const embeddingModel = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

function parseArgs(): CliOptions {
  const opts: CliOptions = {};

  for (const raw of process.argv.slice(2)) {
    const [key, value] = raw.startsWith("--") ? raw.slice(2).split("=") : [raw, ""];
    switch (key) {
      case "domain":
        if (value === "legal" || value === "academic") {
          opts.domain = value;
        } else {
          throw new Error(`Invalid domain "${value}". Use "legal" or "academic".`);
        }
        break;
      case "name":
        opts.name = value;
        break;
      case "dry-run":
      case "dryRun":
        opts.dryRun = true;
        break;
      case "help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (key) {
          console.warn(`Unknown option "${key}" ignored.`);
        }
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage: pnpm ingest [--domain=legal|academic] [--name="Corpus Name"] [--dry-run]

Options:
  --domain     Limit ingestion to a single domain.
  --name       Limit ingestion to one corpus name (exact match).
  --dry-run    Scan files and report actions without hitting Supabase/OpenAI.
`);
}

function assertEnv(name: string, value?: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

async function readSidecar(filePath: string): Promise<DocumentSidecar> {
  const base = filePath.slice(0, filePath.lastIndexOf(path.extname(filePath)));
  const jsonPath = `${base}.json`;
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    return JSON.parse(raw) as DocumentSidecar;
  } catch {
    return {};
  }
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".txt":
    case ".md":
    case ".html":
    case ".htm":
      return await fs.readFile(filePath, "utf8");
    case ".pdf": {
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text ?? "";
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }
    default:
      return "";
  }
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let index = 0;
  while (index < clean.length) {
    const chunk = clean.slice(index, index + size);
    chunks.push(chunk);
    index += size - overlap;
    if (index < 0) index = 0;
  }
  return chunks;
}

function approximateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function ingestCorpus(
  supabase: SupabaseClient,
  openai: OpenAI,
  corpus: CorpusRow,
  opts: CliOptions
): Promise<void> {
  const folder = corpus.metadata?.folder;
  if (!folder) {
    console.warn(`Skipping corpus "${corpus.name}" because no folder metadata is set.`);
    return;
  }

  const absFolder = path.isAbsolute(folder) ? folder : path.join(process.cwd(), folder);

  try {
    await fs.access(absFolder);
  } catch {
    console.warn(`Folder "${absFolder}" not found for corpus "${corpus.name}". Skipping.`);
    return;
  }

  const files = (await walkFiles(absFolder)).filter((file) =>
    supportedExtensions.has(path.extname(file).toLowerCase())
  );

  if (!files.length) {
    console.log(`No ingestible files located for "${corpus.name}" in ${absFolder}.`);
    return;
  }

  console.log(
    `\n[${corpus.domain.toUpperCase()}] ${corpus.name} — processing ${files.length} files from ${absFolder}`
  );

  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileBuffer = await fs.readFile(filePath);
    const checksum = hashBuffer(fileBuffer);

    const sidecar = await readSidecar(filePath);
    const title = sidecar.title ?? path.basename(filePath, path.extname(filePath));
    const docType = sidecar.doc_type ?? corpus.source_type;
    const chunkSize = sidecar.chunk_size ?? corpus.default_chunk_size ?? 800;
    const overlap = sidecar.chunk_overlap ?? Math.floor(chunkSize * 0.2);

    const { data: existingDoc, error: existingError } = await supabase
      .from("documents")
      .select("id, checksum")
      .eq("corpus_id", corpus.id)
      .eq("checksum", checksum)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingDoc) {
      console.log(`- Skipping "${title}" (already ingested).`);
      continue;
    }

    const text = await extractText(filePath);
    if (!text.trim()) {
      console.warn(`- No text extracted from ${relativePath}.`);
      continue;
    }

    const chunks = chunkText(text, chunkSize, overlap);
    if (!chunks.length) {
      console.warn(`- Unable to chunk ${relativePath}.`);
      continue;
    }

    console.log(`- Ingesting "${title}" (${chunks.length} chunks)`);

    if (opts.dryRun) {
      continue;
    }

    const { data: insertedDocuments, error: insertDocError } = await supabase
      .from("documents")
      .insert({
        corpus_id: corpus.id,
        domain: corpus.domain,
        title,
        doc_type: docType,
        jurisdiction: sidecar.jurisdiction ?? null,
        discipline: sidecar.discipline ?? null,
        source_url: sidecar.source_url ?? null,
        file_path: relativePath,
        checksum,
        ingestion_status: "ingested",
        token_count: approximateTokens(text),
        metadata: {
          ...sidecar.metadata,
          auto_generated: true,
        },
      })
      .select("id")
      .single();

    if (insertDocError) throw insertDocError;
    const documentId = insertedDocuments.id;

    let chunkIndex = 0;
    for (const content of chunks) {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: content,
      });
      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        console.warn(`  • Missing embedding for chunk ${chunkIndex} (${title})`);
        continue;
      }

      const { error: chunkError } = await supabase.from("document_chunks").insert({
        document_id: documentId,
        chunk_index: chunkIndex,
        content,
        summary: "",
        embedding,
        token_count: approximateTokens(content),
        metadata: {
          file_path: relativePath,
          chunk_size: chunkSize,
          chunk_overlap: overlap,
        },
      });

      if (chunkError) throw chunkError;
      chunkIndex += 1;
    }
  }
}

async function main() {
  const opts = parseArgs();
  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKey = assertEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  const openaiKey = assertEnv("OPENAI_API_KEY", process.env.OPENAI_API_KEY);

  const supabase: SupabaseClient = createClient<any>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  const openai = new OpenAI({ apiKey: openaiKey });

  let query = supabase.from("corpus_collections").select("*");
  if (opts.domain) {
    query = query.eq("domain", opts.domain);
  }
  if (opts.name) {
    query = query.eq("name", opts.name);
  }

  const { data: corpora, error } = await query;
  if (error) throw error;
  if (!corpora?.length) {
    console.log("No corpus collections matched the provided filters.");
    return;
  }

  for (const corpus of corpora as CorpusRow[]) {
    await ingestCorpus(supabase, openai, corpus, opts);
  }

  console.log("\nIngestion complete.");
}

main().catch((error) => {
  console.error("Ingestion failed:", error);
  process.exit(1);
});
