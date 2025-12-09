-- Default prompt and drafting templates for Legal + Academic labs.
-- Safe to run multiple times thanks to on conflict clauses.

insert into prompt_templates (domain, template_kind, name, description, instructions, version)
values
  (
    'legal',
    'analysis',
    'Legal IRAC Analyzer',
    'Break down case facts, rules, elements, and burdens using IRAC.',
    $$You are a senior legal analyst. Follow IRAC rigor: (1) restate the issue precisely, (2) enumerate every controlling rule or element with citations, (3) apply retrieved facts to each element separately, (4) conclude with likely outcome + risk factors. Always point out ambiguous or missing facts.$$
    ,1
  ),
  (
    'legal',
    'drafting',
    'Legal Motion Draft',
    'Structured pleading outline for motions, briefs, or declarations.',
    $$Produce a court-ready draft. Include Caption, Introduction, Factual Background, Argument (organized element-by-element), Relief Requested, and Signature placeholders. Cite only from retrieved context.$$
    ,1
  ),
  (
    'academic',
    'analysis',
    'Academic Thesis Builder',
    'Socratic reasoning chain for essays or lesson content.',
    $$Adopt a thesis/antithesis/synthesis pattern. 1) Present thesis, 2) Present strongest counterpoint, 3) Synthesize with supporting evidence, 4) Map implications or next study steps. Flag gaps in sources.$$
    ,1
  ),
  (
    'academic',
    'grading',
    'Rubric Evaluator',
    'Score drafts or study artifacts using rubric criteria.',
    $$Score each rubric criterion from 1-5, justify scores with citations, and end with prioritized revision plan.$$
    ,1
  )
on conflict (name, domain) do nothing;

insert into draft_templates (domain, title, doc_type, body_template, structure)
values
  (
    'legal',
    'Protection Order Motion',
    'Motion',
    $$[Caption]

[Introduction]

[Statement of Facts]

[Argument - broken out by statutory element]

[Relief Requested]

[Signature block]$$,
    jsonb_build_object('sections', array['caption','facts','argument','relief'])
  ),
  (
    'academic',
    'Academic Essay',
    'Essay',
    $$Title: {{title}}

Thesis:

Supporting Sections:

Conclusion:

Sources:{{citations}}$$,
    jsonb_build_object('sections', array['thesis','support','conclusion'])
  )
on conflict (title, domain) do nothing;
