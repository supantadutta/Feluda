# Layer II — Investigation Core

The brain. Runs the deduction loop and is the single entry point the Interface
layer (I) calls via `Orchestrator.investigate(query)`.

## The iterative loop

```
screen → plan → [ gather → weigh(Bayesian) → converged? → discriminating follow-up ]·rounds
       → synthesize → calibrate → screen
```

A real investigator iterates. The **InvestigationPlanner** sets depth from the
question (simple/factual → one round; causal/complex/multi-part → up to 3). Each
round gathers evidence, the **BayesianEvidenceWeigher** updates beliefs
(`posterior ∝ prior · ∏ likelihood`), and the loop checks whether a hypothesis
**dominates** (belief ≥ target *and* leads the runner-up by a margin). If not,
the **DiscriminatingQuestioner** asks the question that best separates the two
leading hypotheses, and the next round gathers targeted evidence. The loop stops
on convergence, an exhausted round budget, or when no new evidence arrives — the
`Verdict.investigation` summary records which.

### Bayesian belief updating

Likelihood comes from each evidence item's **stance** toward a hypothesis:
topical similarity combined with per-term affirmation/negation and antonyms, so
"forged, not authentic" supports *forged* and contradicts *authentic* — not
both. Only each hypothesis's **distinctive** terms count, so boilerplate shared
by rival hypotheses cannot sway belief. Neutral evidence carries baseline
likelihood 0.5. Supporting/contradicting evidence ids are recorded on each
hypothesis for the trace.

### Confidence reflects dominance

The calibrator caps confidence below "high" without corroboration, and also when
the leading hypotheses remain **close** (low separation) — a near-tie is itself a
reason for humility.

## The original single-pass description

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
