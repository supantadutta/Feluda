# Layer III — Multi-AI Council

Consults several models and synthesizes a stronger answer. Wired into the loop's
**cross-examine** step (optional).

## Pieces

- **Model Gateway** (provider-agnostic) — `AnthropicGateway` (default) +
  `StubGateway` (offline). Other providers slot in behind `ModelGateway`.
- **Council** — fans the synthesis task out to a panel of `PanelMember`s in
  parallel (`Promise.all`).
- **Disagreement Detector** — `agreementOf()` scores mean pairwise answer
  similarity; below threshold (0.6) the panel's divergent answers become
  explicit `dissent` (divergence is signal, not noise).
- **Judge** — picks the strongest answer as the base; on dissent a judge model
  merges the panel's reasoning into one verdict and lowers confidence.
- **Specialist Routing** — `SpecialistRouter` maps task type (code, math,
  long-context, vision) to the best model id.
- **Cost control** — estimates panel cost; over the cap (or with <2 seats) it
  **falls back to a single model** (`fellBackToSingle`).

## Output

A `CouncilReport` rides on the `Verdict`: `panel`, `agreement`, `dissent`,
`fellBackToSingle`. The UI surfaces agreement and lists dissent.

## Wiring

Opt-in via `COUNCIL_ENABLED=true`. Seats come from `FELUDA_COUNCIL_MODELS`
(comma-separated model ids); with fewer than two it seats the default model
twice so the mechanism is demonstrable. The cap is `COUNCIL_COST_CAP_USD`.

## Investigative council (role-based review)

Beyond the model panel, `InvestigativeCouncil` runs a **deterministic, offline**
QA pass over every draft verdict — distinct lenses, no extra model calls:

| Role | Checks |
| ---- | ------ |
| Lead | frames the picture (hypotheses vs evidence) |
| Skeptic / Red-Team | near-ties, weakly-supported leaders, more-contradicting-than-supporting |
| Source-Verifier | citation grades (D/F), staleness, corroboration across hosts |
| OSINT | offline-fixture coverage |
| Cyber | overconfident language unsupported by belief |
| Ethics | re-screens the output against the boundaries |
| Judge | calibrated recommendation: `proceed` / `gather_more` / `do_not_conclude` |

The review rides on `Verdict.councilReview` (findings + missing evidence +
recommendation) and is surfaced in the UI. Endpoint: `POST /api/council/review`.

## Tests

`council.test.ts` proves: dissent is surfaced when answers diverge; agreement is
high when they match; the cost cap demonstrably falls back to one model; routing
selects the right model with a fallback. `investigative-council.test.ts` proves
the role-based review challenges near-ties, flags overclaiming, proceeds on
dominant corroborated conclusions, and rides on the verdict.
