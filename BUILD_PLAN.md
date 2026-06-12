# BUILD_PLAN.md — Feluda, Phase by Phase

Build in order. Don't start a phase until the previous one passes its acceptance
criteria. Each phase lists a **prompt** to give Claude Code and a **done when**
checklist.

---

## Phase 0 — Scaffold

**Prompt:**
> Set up the Feluda monorepo per CLAUDE.md: TypeScript, a Fastify API server, a
> React+Vite PWA front end, Vitest, ESLint/Prettier, and a `.env.example`.
> Create the folder structure for the 7 layers in SPEC.md as empty modules with
> documented interfaces. Don't implement logic yet. Give me a tree + run
> instructions.

**Done when:** repo runs (`dev` script starts API + web), tests pass empty,
`.env.example` exists, `.gitignore` covers `.env` and `node_modules`.

---

## Phase 1 — Investigation Core + Ethics (the usable MVP)

**Prompt:**
> Implement Layer II (Investigation Core) and Layer VII (Ethics & Trust) from
> SPEC.md, plus a minimal Layer I chat UI. One AI provider (Anthropic) is enough
> for now. The chat must run the deduction loop: for a real question it forms
> hypotheses, reasons, and returns an answer WITH a reasoning trace and a
> confidence level. Wire in the Ethics boundaries as a request/response filter
> with tests. No web search or memory yet — reason over what's given.

**Done when:**
- I can chat with Feluda in the browser.
- Answers include reasoning trace + confidence.
- Boundary tests pass (a disallowed request is refused with a lawful alternative).
- Audit log records each turn.

---

## Phase 2 — Evidence & Sources

**Prompt:**
> Implement Layer IV. Add live web search behind the Evidence interface, a Source
> Verifier that scores credibility, a Cross-Checker that wants ≥2 sources for
> significant claims, and a Citation Trail so every external fact links to its
> origin. Connect this into the deduction loop's "gather evidence" step. Add doc
> ingest (PDF) as a stretch.

**Done when:** answers to factual questions show citations; weak/single-source
claims are flagged; there's a test proving no fabricated citations slip through.

---

## Phase 3 — Memory

**Prompt:**
> Implement Layer V's Knowledge Vault and Case Memory: a local swappable vector
> store, document embedding, and retrieval wired into the loop. Feluda should
> recall prior cases and user notes. Keep the store behind an interface so it can
> be swapped later.

**Done when:** Feluda answers a follow-up using something from an earlier
session; I can add notes and have them retrieved.

---

## Phase 4 — Multi-AI Council

**Prompt:**
> Implement Layer III. Make the Model Gateway provider-agnostic, add Panel
> Reasoning (parallel multi-model), a Disagreement Detector, and a Synthesizer
> judge step. Add a cost cap with single-model fallback and specialist routing by
> task type. Surface dissent in the final answer.

**Done when:** a question can be answered by a panel; the UI shows where models
agreed/disagreed; the cost cap demonstrably falls back to one model.

---

## Phase 5 — Action

**Prompt:**
> Implement Layer VI: Report Builder (PDF/DOCX export), Data & Charts (code
> sandbox for dataset analysis + visualizations), defensive-only security helpers
> (log triage, detection-rule drafting), and Daily Ops (calendar/reminders/
> tasks). Consequential actions must hit the approval gate from Layer VII.

**Done when:** Feluda exports a case report; analyzes a sample CSV with a chart;
an action asks for confirmation before running.

---

## Phase 6 — Adaptive Learning

**Prompt:**
> Implement the Feedback Loop, Pattern Library, and Self-Review in Layer V.
> Corrections I give should measurably change later behavior (stored as
> preferences/data, not model retraining). Self-Review should re-open a past
> verdict when new evidence contradicts it.

**Done when:** correcting Feluda changes a later answer; a saved "playbook"
speeds up a repeat case type; a contradicting fact triggers a flagged re-review.

---

## Phase 7 — Interface Polish

**Prompt:**
> Build out Layer I: the Case Dashboard (evidence board, timeline, link-graph),
> scheduled Briefings, and voice mode (STT in / TTS out). Make it a clean,
> installable PWA.

**Done when:** dashboard shows an investigation visually; a scheduled briefing
fires; I can talk to Feluda and hear it answer.

---

## Working rhythm (every phase)

1. Claude Code restates the goal + acceptance criteria.
2. Proposes a file plan; you approve.
3. Implements + writes tests.
4. Runs tests, gives a 5-line summary + "try it like this."
5. You test, then say "proceed to next phase."

Keep `.env` keys ready as you go: an Anthropic API key (Phase 1), a web-search
API key (Phase 2), and any additional provider keys (Phase 4).
