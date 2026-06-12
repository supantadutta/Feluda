# SPEC.md — Feluda Architecture & Product Spec

This is the full picture. `BUILD_PLAN.md` slices it into phases. Build against
this spec, but only implement the phase you're currently on.

## The deduction loop (the heart of the product)

Every non-trivial query flows through this loop. It's what makes Feluda an
investigator rather than a chatbot.

```
Question
  → Gather evidence        (Layer IV: authentic sources)
  → Form hypotheses        (Layer II: rival explanations)
  → Cross-examine          (Layer III: multiple AI minds, optional)
  → Weigh & test           (Layer II: score evidence vs each hypothesis)
  → Reasoned verdict       (answer + reasoning trace + confidence + citations)
```

Simple factual queries may short-circuit the loop (one source, direct answer).
The orchestrator decides depth based on the question.

## Layer I — Interface

How the user reaches Feluda.

- **Chat & Voice** — web/mobile chat; voice mode (speech-to-text in,
  text-to-speech out) as a later enhancement.
- **Case Dashboard** — open investigations, an evidence board, timelines, and a
  link-graph view of how facts connect.
- **Briefings** — scheduled digests on topics the user tracks.
- **API / CLI** — REST + webhooks so Feluda plugs into other tools.

## Layer II — Investigation Core (the brain)

The orchestrator that runs the deduction loop.

- **Orchestrator** — agentic plan → act → verify loop; decides which tools to
  call and how deep to investigate.
- **Hypothesis Engine** — generates competing explanations (abductive
  reasoning), keeps them explicit.
- **Evidence Weigher** — scores each fact for strength + relevance; updates
  belief in each hypothesis as evidence arrives (Bayesian-style).
- **Confidence Calibrator** — produces an honest confidence level and names the
  gaps. Never inflates certainty.
- **Reasoning Tracer** — records the full chain from clue → verdict so the user
  can audit it.

## Layer III — Multi-AI Council

Consult several AI models and synthesize a stronger answer.

- **Model Gateway** — one provider-agnostic interface; providers are adapters
  behind it.
- **Panel Reasoning** — fan the same question out to multiple models in parallel.
- **Disagreement Detector** — surface where models diverge (divergence is
  signal, not noise).
- **Synthesizer** — a judge step that merges the strongest reasoning into one
  answer, noting dissent.
- **Specialist Routing** — route by task type (code, math, long-context, vision)
  to the model best suited.
- **Cost control** — configurable cap; falls back to a single model when the cap
  is hit or the query is simple.

## Layer IV — Evidence & Sources

Pull only from credible, verifiable sources; trace everything.

- **Web & News** — live search, recency-ranked.
- **Authoritative Feeds** — government, academic, standards bodies, official
  records — primary sources first.
- **Source Verifier** — score credibility; flag low-quality or single-source
  claims.
- **Cross-Checker** — require corroboration across ≥2 independent sources for
  significant claims.
- **Citation Trail** — every fact carries a provenance link.
- **Doc & Data Ingest** — user-supplied PDFs, datasets, images (parse / OCR /
  extract).

## Layer V — Memory & Adaptive Learning

Remembers context; gets sharper over time within safe bounds.

- **Knowledge Vault** — RAG store of the user's notes, findings, prior cases.
- **Case Memory** — summarized history of conversations, decisions, threads.
- **Feedback Loop** — user corrections tune future answers (preference learning,
  stored as data — not model retraining).
- **Pattern Library** — reusable reasoning templates per case type ("playbooks").
- **Self-Review** — revisit prior verdicts when new evidence arrives (belief
  revision).

## Layer VI — Action

Turn conclusions into deliverables; handle daily admin.

- **Report Builder** — case files, briefs, docs in the user's style (PDF/DOCX).
- **Data & Charts** — analyze datasets and visualize findings in a code sandbox.
- **Defensive Security** — log triage, detection-rule drafting, hardening
  checklists. Defensive scope only.
- **Daily Ops** — calendar, reminders, follow-ups, task tracking.

## Layer VII — Ethics & Trust (cross-cutting)

A standing boundary over every layer above.

- **Lawful-Use Gate** — public info only; no stalking/surveillance/doxxing/
  private-data digging.
- **Defensive Filter** — blocks offensive-cyber / weapon uplift.
- **Uncertainty Honesty** — calibrated humility baked into outputs.
- **Audit & Approval** — actions logged; consequential ones need confirmation.
- **Secrets Vault** — keys/credentials isolated, encrypted, never in prompts.

## Data flow summary

```
User → Interface(I) → Orchestrator(II)
                         ├─ asks Evidence(IV) for facts  ──► Source Verifier ► Citation Trail
                         ├─ optionally asks Council(III)  ──► Panel ► Synthesizer
                         ├─ reads/writes Memory(V)
                         ├─ may trigger Action(VI)        ──► (approval gate)
                         └─ everything filtered by Ethics(VII)
                       ↓
            Verdict + reasoning trace + confidence + citations → Interface(I)
```

## Non-goals (for now)

- Not a real-time market/trading system.
- Not an autonomous agent that acts without confirmation on consequential steps.
- Not a private-data aggregator or OSINT-on-individuals tool.
- Does not retrain underlying models; "learning" = memory + feedback + patterns.
