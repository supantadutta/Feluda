# Layer V — Memory & Adaptive Learning

Remembers context and gets sharper over time within safe bounds. Phase 3 ships
the Knowledge Vault and Case Memory; adaptive learning (feedback, playbooks,
self-review) arrives in Phase 6.

## Pieces

- **Embedder** (`LocalEmbedder`) — a deterministic, dependency-free hashing
  embedder, so memory works offline and in tests. Swappable behind the
  `Embedder` interface for a semantic embedding API later.
- **VectorStore** — `InMemoryVectorStore` (process-local) and `FileVectorStore`
  (JSON persistence). Behind the `VectorStore` interface so sqlite-vec / LanceDB
  can replace it without touching callers.
- **KnowledgeVault** (the `MemoryPort`) — `recall`, `remember`, `addNote`, and
  `rememberCase`. The RAG store of notes and prior cases.

## In the loop

```
... screen → recall (Layer V) → gather → hypothesize → ... → verdict → rememberCase (Layer V)
```

- Before forming hypotheses, the orchestrator recalls the top relevant notes and
  prior cases and feeds them as **prior context** to the hypothesis and
  synthesis prompts (clearly separated from external evidence — recalled memory
  is not a citation).
- After producing a verdict, the orchestrator writes a Case Memory summary back,
  so a later related question recalls it (a cross-session follow-up).

## API

- `POST /api/notes` — add a free-text note to the vault.
- `GET /api/memory/recall?q=…` — see what memory holds for a query.

## Adaptive learning (Phase 6)

Learning here means **memory + feedback + patterns — never model retraining**
(SPEC non-goals).

- **Feedback Loop** (`FeedbackStore`) — user corrections/preferences are stored
  as data and the relevant ones are injected into later synthesis prompts
  ("corrections to honour"). The trace records when preferences are applied.
  `POST /api/feedback`.
- **Pattern Library** (`PatternLibrary`) — playbooks per case type. A question
  matching a playbook's triggers reuses its seed hypotheses, so a repeat case
  type is investigated faster/consistently. `POST /api/playbooks`.
- **Self-Review** (`SelfReview`) — belief revision. When new evidence arrives, it
  recalls related prior cases and flags any whose verdict the evidence
  contradicts (subject overlap + polarity flip via negation/antonym). Flags ride
  on the verdict (`reviewFlags`) and are surfaced in the UI; `POST /api/self-review`
  checks a claim directly.

## Boundary

`MemoryPort.recall/remember/rememberCase`. The store path is config-driven
(`VECTOR_STORE_PATH`); nothing here reaches a provider SDK or secret. Recalled
memory is the user's own data — never an external claim, so it is never emitted
as a citation.
