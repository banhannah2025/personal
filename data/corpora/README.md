# Training Dashboard Corpora

Drop your source documents into the domain folders below so the ingestion tooling can locate, tag, and chunk them:

- `legal/statutes`: RCW/WAC text, CFR, and other statutory compilations.
- `legal/court_rules`: local + federal rules, jury instructions, procedure manuals.
- `legal/case_law`: case summaries, slip opinions, digests.
- `legal/practice_notes`: templates, pleadings, sample motions.
- `legal/expert_notes`: your corrections, annotations, internal memos.
- `academic/stem`: math/CS/engineering/science lecture notes, textbooks, research papers.
- `academic/humanities`: history, literature, social science readings.
- `academic/professional`: business, education, health, policy materials.
- `academic/rubrics`: grading rubrics, assignment prompts, evaluation checklists.
- `academic/instructor_notes`: your commentary, lesson plans, expert corrections.

### File Handling

1. Place PDFs, DOCX, text, or Markdown files inside the appropriate folder.
2. If you have metadata for a document (jurisdiction, discipline, citation), add a sibling `.json` file with the same name (e.g., `rcw_family_law.pdf` + `rcw_family_law.json`).
3. Keep privileged or sensitive materials encrypted if required; the ingestion scripts will respect whatever folder structure you provide.

Once files land here and you trigger the ingestion job, we’ll map them to the Supabase `corpus_collections` entries with matching domain + folder names.
