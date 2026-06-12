# Feluda

A calm, rigorous **investigative reasoning assistant**. Given a question, Feluda
gathers evidence from authentic sources, weighs rival hypotheses, optionally
consults multiple AI models, and answers with a transparent reasoning trace, a
calibrated confidence level, and citations. It shows its work and never bluffs.

See [`CLAUDE.md`](./CLAUDE.md) (constitution), [`SPEC.md`](./SPEC.md)
(architecture) and [`BUILD_PLAN.md`](./BUILD_PLAN.md) (phased roadmap).

> **Status: Phase 0 — Scaffold.** Monorepo, tooling, and the 7-layer module
> skeleton are in place. No layer logic yet.

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
| I — Interface | `layer1-interface` | interface only |
| II — Investigation Core | `layer2-investigation-core` | interface only |
| III — Multi-AI Council | `layer3-council` | interface only |
| IV — Evidence & Sources | `layer4-evidence` | interface only |
| V — Memory & Adaptive Learning | `layer5-memory` | interface only |
| VI — Action | `layer6-action` | interface only |
| VII — Ethics & Trust | `layer7-ethics` | interface only |

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

## Boundaries

The hard boundaries in `CLAUDE.md` (lawful/public info only, defensive security
only, no weapon/CBRN uplift, secrets only in `.env`/vault, human-in-the-loop for
consequential actions) are non-negotiable and enforced by Layer VII.
