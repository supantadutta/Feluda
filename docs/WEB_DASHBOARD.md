# Web Dashboard (Layer I)

A calm, evidence-first analyst workspace (React + Vite PWA, Tailwind). Tabs:

- **Chat** — the deduction loop; each answer renders via `VerdictView` (answer,
  confidence, reasoning trace, hypotheses, citation trail, council review,
  self-review flags). Optional voice in/out.
- **Dashboard** — the session's investigations as an evidence board, timeline,
  and link-graph.
- **OSINT** — enter an indicator (domain/IP/URL/email/hash/CVE); shows the
  classified target, a **graded findings table** (A–F, category, source),
  extracted entities, and honest offline/scope notes. Doxxing/deanonymisation/
  intrusive requests are refused by the server.
- **SOC** — defensive alert triage form (alert type, title, context, logs);
  shows the verdict badge, confidence, reasoning, and **defensive-only**
  recommended actions, plus an escalate flag.
- **Cases** — create cases, investigate within a case, and view hypotheses,
  evidence, timeline, and unresolved questions.

## Client

`packages/web/src/api.ts` typed against `@feluda/core` types: `investigate`,
`osintInvestigate`, `socInvestigate`, and `casesApi` (list/create/get/
investigate/report). Base URL from `VITE_API_BASE_URL`.

## Style

Calm detective workspace: dark slate, readable tables, evidence-first, grades
and verdicts colour-coded, export-ready reports. No flashy chrome.

## Tests

`panels.test.tsx` renders the OSINT/SOC/Cases panels (fetch stubbed) and asserts
the passive/defensive notes are present.
