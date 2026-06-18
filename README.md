# Feluda

A calm, rigorous **investigative reasoning assistant**. Given a question, Feluda
gathers evidence from authentic sources, weighs rival hypotheses, optionally
consults multiple AI models, and answers with a transparent reasoning trace, a
calibrated confidence level, and citations. It shows its work and never bluffs.

See [`CLAUDE.md`](./CLAUDE.md) (constitution), [`SPEC.md`](./SPEC.md)
(architecture) and [`BUILD_PLAN.md`](./BUILD_PLAN.md) (phased roadmap).

> **Status: Phases 0–7 complete.** All seven layers are implemented and tested.
> The whole stack runs offline (deterministic stubs/fixtures) with no keys, and
> upgrades to live providers when keys are set.

## Monorepo layout

```
feluda/
├── packages/
│   ├── core/   @feluda/core — the 7 architecture layers as modules
│   ├── api/    @feluda/api  — Fastify server (Layer I: API surface)
│   └── web/    @feluda/web  — React + Vite PWA (Layer I: chat/dashboard)
└── docs/       per-layer docs, written as each layer lands
```

The 7 layers (see `SPEC.md`) live in `packages/core/src/`:

| Layer | Module | Status |
| ----- | ------ | ------ |
| I — Interface | `layer1-interface` | ✅ chat, dashboard, briefings, voice, PWA |
| II — Investigation Core | `layer2-investigation-core` | ✅ deduction loop, trace, confidence |
| III — Multi-AI Council | `layer3-council` | ✅ panel, dissent, judge, cost cap, routing |
| IV — Evidence & Sources | `layer4-evidence` | ✅ search, verifier, cross-check, citations, ingest |
| V — Memory & Adaptive Learning | `layer5-memory` | ✅ vault, case memory, feedback, playbooks, self-review |
| VI — Action | `layer6-action` | ✅ reports, charts, defensive security, ops, approval gate |
| VII — Ethics & Trust | `layer7-ethics` | ✅ boundary gate, audit log, approval gate |

Per-layer docs live in [`docs/`](./docs).

## Prerequisites

- Node **18+** (tested on Node 22)
- npm 9+

## Setup

```bash
npm install
cp .env.example .env   # fill in keys as phases require them (none needed for Phase 0)
```

## Run

```bash
npm run dev      # starts the API (http://localhost:3001) and web (http://localhost:5173)
```

Check the API is up:

```bash
curl http://localhost:3001/health
# { "status": "ok", "service": "feluda-api", "coreVersion": "0.0.0", "phase": 0 }
```

## Test, lint, typecheck

```bash
npm test          # run all package test suites (Vitest)
npm run lint      # ESLint
npm run typecheck # TypeScript, per workspace
npm run format    # Prettier
```

## Offline vs live mode

Every external dependency has a deterministic offline fallback so the whole app
runs and is fully tested without keys or network:

| Capability | Offline default | Live (set in `.env`) |
| ---------- | --------------- | -------------------- |
| Model (Layer III) | `StubGateway` | `ANTHROPIC_API_KEY` |
| Web search (Layer IV) | `FixtureSearchProvider` | `WEB_SEARCH_API_KEY` |
| Council (Layer III) | disabled | `COUNCIL_ENABLED=true`, `FELUDA_COUNCIL_MODELS` |
| Embeddings (Layer V) | `LocalEmbedder` | swap behind `Embedder` |

`/health` reports the current mode for each.

## Investigation platform (OSINT / SOC)

Beyond chat, Feluda is a lawful, passive investigation platform:

- **Iterative deduction** — multi-round Bayesian belief updating with
  discriminating follow-up questions (Layer II).
- **OSINT engine** — target classification, entity extraction, A–F source
  grading, passive profiles (`docs/OSINT_ENGINE.md`).
- **SOC workflows** — defensive alert triage across 12 alert types
  (`docs/SOC_WORKFLOWS.md`).
- **Cases** — first-class case records, timeline, professional reports
  (`docs/INVESTIGATION_CASES.md`).
- **Investigative council** — role-based scrutiny (Skeptic/Verifier/Ethics/Judge).
- **Web dashboard** — OSINT / SOC / Cases panels (`docs/WEB_DASHBOARD.md`).

### CLI

```bash
npm run feluda -- investigate "Why did the login fail?"
npm run feluda -- osint --target example.com --type domain
npm run feluda -- soc --type brute_force --log "Failed password for admin" --log "..."
```

## Key REST endpoints

`POST /api/investigate` · `POST /api/osint/investigate` ·
`POST /api/osint/extract-entities` · `POST /api/soc/investigate` ·
`POST /api/cases` (+ `evidence`/`investigate`/`timeline`/`report`) ·
`POST /api/council/review` · `POST /api/notes` · `GET /api/memory/recall` ·
`POST /api/ingest` · `POST /api/actions` · `POST /api/feedback` ·
`POST /api/playbooks` · `POST /api/self-review` · `POST /api/briefings`.

## Boundaries

The hard boundaries in `CLAUDE.md` (lawful/public info only, defensive security
only, no weapon/CBRN uplift, secrets only in `.env`/vault, human-in-the-loop for
consequential actions) are non-negotiable and enforced by Layer VII. The Ethics
gate screens every request and response; consequential actions hit the approval
gate; citations are never fabricated; and confidence is never inflated past the
evidence.
