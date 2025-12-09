-- Seed corpus collections for Legal Lab and Academic Lab.
-- Run after training_dashboard_schema.sql has been applied.

-- Legal corpora
insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'legal', 'Statutory Law (RCW/WAC)', 'Codified statutes and administrative codes', 'statute', 'public',
       jsonb_build_object('folder', 'data/corpora/legal/statutes', 'preferred_format', array['pdf','html','txt'])
where not exists (
  select 1 from corpus_collections where domain = 'legal' and name = 'Statutory Law (RCW/WAC)'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'legal', 'Court Rules & Procedure', 'Local, state, and federal procedural rules + jury instructions', 'rule', 'public',
       jsonb_build_object('folder', 'data/corpora/legal/court_rules', 'preferred_format', array['pdf','docx'])
where not exists (
  select 1 from corpus_collections where domain = 'legal' and name = 'Court Rules & Procedure'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'legal', 'Case Law Summaries', 'Judicial opinions, slip decisions, case digests', 'case', 'public',
       jsonb_build_object('folder', 'data/corpora/legal/case_law', 'preferred_format', array['pdf','html','md'])
where not exists (
  select 1 from corpus_collections where domain = 'legal' and name = 'Case Law Summaries'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'legal', 'Practice Templates & Pleadings', 'Motions, declarations, briefs, and templates you reuse', 'template', 'restricted',
       jsonb_build_object('folder', 'data/corpora/legal/practice_notes', 'preferred_format', array['docx','md'])
where not exists (
  select 1 from corpus_collections where domain = 'legal' and name = 'Practice Templates & Pleadings'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'legal', 'Expert Notes & Corrections', 'Your personal analysis, corrections, and legal strategy notes', 'notes', 'restricted',
       jsonb_build_object('folder', 'data/corpora/legal/expert_notes', 'preferred_format', array['md','txt'])
where not exists (
  select 1 from corpus_collections where domain = 'legal' and name = 'Expert Notes & Corrections'
);

-- Academic corpora
insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'academic', 'STEM Textbooks & Papers', 'Math, science, engineering textbooks and research PDFs', 'textbook', 'public',
       jsonb_build_object('folder', 'data/corpora/academic/stem', 'preferred_format', array['pdf','epub','md'])
where not exists (
  select 1 from corpus_collections where domain = 'academic' and name = 'STEM Textbooks & Papers'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'academic', 'Humanities & Social Sciences', 'History, literature, civics, sociology readings and notes', 'textbook', 'public',
       jsonb_build_object('folder', 'data/corpora/academic/humanities', 'preferred_format', array['pdf','md'])
where not exists (
  select 1 from corpus_collections where domain = 'academic' and name = 'Humanities & Social Sciences'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'academic', 'Professional & Applied Studies', 'Business, education, health, criminal justice materials', 'reference', 'public',
       jsonb_build_object('folder', 'data/corpora/academic/professional', 'preferred_format', array['pdf','pptx','docx'])
where not exists (
  select 1 from corpus_collections where domain = 'academic' and name = 'Professional & Applied Studies'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'academic', 'Rubrics & Assessments', 'Assignment prompts, grading rubrics, evaluation checklists', 'rubric', 'restricted',
       jsonb_build_object('folder', 'data/corpora/academic/rubrics', 'preferred_format', array['md','docx'])
where not exists (
  select 1 from corpus_collections where domain = 'academic' and name = 'Rubrics & Assessments'
);

insert into corpus_collections (domain, name, description, source_type, access_level, metadata)
select 'academic', 'Instructor Notes & Feedback', 'Your lectures, commentary, and expert corrections', 'notes', 'restricted',
       jsonb_build_object('folder', 'data/corpora/academic/instructor_notes', 'preferred_format', array['md','txt'])
where not exists (
  select 1 from corpus_collections where domain = 'academic' and name = 'Instructor Notes & Feedback'
);
