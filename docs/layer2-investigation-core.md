# Layer II — Investigation Core

The brain. Runs the deduction loop and is the single entry point the Interface
layer (I) calls via `Orchestrator.investigate(query)`.

## The loop (Phase 1)

```
screen(request) → gather → hypothesize → weigh → synthesize → calibrate → screen(response)
```

- **gather** — short-circuited in Phase 1 (no Evidence layer yet). The trace
  records that reasoning is over the question + general knowledge, with no
  external citations.
- **hypothesize** — `LlmHypothesisEngine` asks the model for 2–4 competing
  explanations, each with a prior `belief`.
- **weigh** — `NormalizingEvidenceWeigher` normalises priors. Bayesian updates
  from real evidence arrive in Phase 2.
- **synthesize** — `LlmSynthesizer` produces the answer, the reasoning steps,
  and a self-assessed confidence + gaps.
- **calibrate** — `BandConfidenceCalibrator` has the final say on the number.
  **Without external evidence, confidence is capped below "high"** and a standing
  "no external evidence" gap is always recorded (calibrated honesty).

## Components

| Component | Type | Notes |
| --------- | ---- | ----- |
| `DeductionOrchestrator` | `Orchestrator` | wires the loop; screens in/out via Layer VII |
| `LlmHypothesisEngine` | `HypothesisEngine` | abductive, keeps rivals explicit |
| `NormalizingEvidenceWeigher` | `EvidenceWeigher` | Phase 1 normaliser |
| `BandConfidenceCalibrator` | `ConfidenceCalibrator` | never inflates certainty |
| `ArrayReasoningTracer` | `ReasoningTracer` | auditable clue → verdict chain |

## Output

Every turn returns a `Verdict`: `answer`, `trace`, `confidence` (score, band,
gaps), `citations` (empty in Phase 1 — never fabricated), and `hypotheses`. A
blocked turn returns a `Verdict` with a `refusal` carrying the boundary and a
lawful alternative.

## Boundary

The orchestrator depends only on three injected ports: a `ModelGateway`
(Layer III), an `EthicsGate`, and an `AuditLog` (Layer VII). It never reaches a
provider SDK or secret directly.
