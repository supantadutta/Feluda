# Investigation Case System (Layer II)

A first-class case ties an investigation together over time.

## Case record

`id, title, objective, scope, boundaries, subjectEntities, evidence,
hypotheses, confidenceHistory, timeline, unresolvedQuestions, riskFlags,
ethicsFlags, report, status, createdAt/updatedAt`.

New cases get **default lawful boundaries** (public-source only, defensive only,
no doxxing/deanonymisation).

## CaseManager

- `create(input)` — open a case.
- `addEvidence(id, evidence[])` — attach evidence; auto-extracts entities (into
  `subjectEntities`) and dated events (into `timeline`).
- `applyVerdict(id, question, verdict)` — fold an investigation result in:
  hypotheses, a `confidenceHistory` point, unresolved questions (the named
  confidence gaps), risk flags (self-review), and ethics flags (refusals).
- `setReport(id, markdown)` — close the case with its report.

Storage sits behind `CaseStore` (`InMemoryCaseStore` by default; swap for a DB).

## Timeline reconstruction

`buildTimeline(text, source)` extracts ISO and syslog timestamps and relative
dates ("yesterday"). Ambiguous/undated events are **kept with an `uncertainty`
note**, never guessed; dated events are sorted chronologically.

## Reports

`CaseReportBuilder.build(case, type)` → `osint_case | executive |
incident_timeline | hypothesis_analysis | evidence_appendix`. Citation-backed,
Markdown (printable to PDF). Citations are drawn only from the case's evidence —
never fabricated.

## API

`POST /api/cases` · `GET /api/cases` · `GET /api/cases/:id` ·
`POST /api/cases/:id/evidence` · `POST /api/cases/:id/investigate` ·
`GET /api/cases/:id/timeline` · `GET /api/cases/:id/report?type=`.
