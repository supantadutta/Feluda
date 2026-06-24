# Synthetic Learning (Layer V, adaptive)

Feluda generates labelled **synthetic** investigation scenarios, trains a
lightweight online pattern learner on them, and measures how its accuracy
improves with experience. This is **learning as data, not LLM retraining** (per
the SPEC non-goals): the learner is a nearest-centroid classifier over the
offline embedder, used to route a new case to a likely category/playbook — a
learned prior that complements the model, never replaces or retrains it.

## How it works

1. `generateScenarios(perClass, seed)` deterministically emits labelled cases per
   category (brute_force, phishing, malware_hash, benign_admin, port_scan) with
   class-distinct vocabulary.
2. `PatternLearner.observe(text, label)` updates that label's centroid;
   `predict(text)` returns the nearest centroid's label.
3. `SyntheticTrainer.run({ rounds, perClassPerRound })` adds fresh phrasing each
   round and scores a held-out test set, producing an accuracy curve.

## What it proves

A real, measurable learning curve (deterministic):

```
baseline (random) 20%  →  R1 60% → R2 88% → R3 92% → R4 96% → R5 100%
```

`eval`-style honesty applies: the report includes the random baseline and the
**lift** (final − baseline), so the improvement is explicit, not hand-waved.

## Run it

- API: `POST /api/learning/run { rounds }` → `{ report }`.
- UI: the **Learning** tab runs training and animates the accuracy curve.
- Test: `learning.test.ts` asserts final accuracy ≥ 0.8, lift > 0.3, and
  determinism (same run → same curve).

## Boundary

Synthetic scenarios are generated internally — no real personal data is used or
memorised. The learned model is a routing prior only; consequential conclusions
still flow through the deduction loop, evidence, and the ethics gate.
