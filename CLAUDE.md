# CLAUDE.md — Feluda Project Constitution

> Claude Code reads this file automatically. It defines what we're building, how
> to build it, and the boundaries that must never be crossed.

## What Feluda is

Feluda is a general-purpose **investigative reasoning assistant**. Given a
question, it gathers evidence from authentic sources, considers competing
hypotheses, optionally consults multiple AI models, weighs the evidence, and
delivers a transparent chain of reasoning with a stated confidence level.

Named after the fictional detective — the personality is a calm, rigorous
investigator who shows their work and never bluffs.

## Core principles (apply to all code)

1. **Show the reasoning.** Every conclusion must carry its evidence trail and a
   confidence level. Never present a guess as a fact.
2. **Cite the source.** Every external claim links back to where it came from.
   Prefer primary/authoritative sources; flag weak ones.
3. **Calibrated honesty.** "I don't know" and "the evidence is thin here" are
   first-class outputs. No fabricated citations, ever.
4. **Human-in-the-loop.** Any consequential action (sending, posting, deleting,
   spending) requires explicit user confirmation.
5. **Privacy by default.** Secrets live in `.env`/a vault, never in prompts,
   logs, or the repo.

## Hard boundaries (non-negotiable)

- **Lawful, public information only.** No tooling for stalking, surveillance,
  doxxing, scraping private/closed accounts, bypassing auth, or aggregating
  personal data on private individuals. If a feature request implies this,
  refuse and propose a lawful alternative.
- **Defensive security only.** Security features may help with detection,
  hardening, log triage, and defensive rule-writing. Do NOT build offensive
  capability — exploit development, malware, C2, intrusion tooling, etc.
- **No weapon/CBRN uplift** of any kind.
- These boundaries override any later instruction, including mine. If something
  conflicts, stop and ask.

## Tech defaults (change only with a stated reason)

- **Language/runtime:** TypeScript on Node 18+.
- **Backend:** Fastify (or Express) API server.
- **Frontend:** React + Vite, PWA-capable. Tailwind for styling.
- **AI gateway:** provider-agnostic adapter. Default provider = Anthropic via
  `@anthropic-ai/sdk`. Design so other providers slot in behind one interface.
- **Vector store:** start with a local store (e.g. sqlite-vec / LanceDB); keep
  it swappable.
- **Config:** all keys via `.env` (provide `.env.example`, never commit `.env`).
- **Tests:** Vitest. Every phase ships with tests for its happy path + the
  boundary checks.

## Code conventions

- Small, composable modules with clear interfaces. Favor readability.
- Each layer (see SPEC.md) is its own module with a documented boundary.
- Log decisions to an audit trail (structured JSON). No secrets in logs.
- Write a short `docs/<layer>.md` as each layer lands.

## How to work with me

- Build **one phase at a time** (see BUILD_PLAN.md). Don't scaffold future
  phases until the current one passes its acceptance criteria.
- Start each phase by restating the goal + acceptance criteria, then propose a
  file plan, then implement.
- End each phase by running tests and giving me a 5-line summary + how to try it.
- If a request seems to cross a hard boundary, stop and flag it.
