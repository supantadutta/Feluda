# Layer IV — Evidence & Sources

Pulls only from credible, verifiable sources and traces everything. Wired into
the deduction loop's **gather** step.

## Pipeline

```
search → score credibility → cross-check (≥2 independent hosts) → citation trail
```

- **SearchProvider** (provider-agnostic): `TavilySearchProvider` (live, needs
  `WEB_SEARCH_API_KEY`) or `FixtureSearchProvider` (offline, clearly flagged).
- **HeuristicSourceVerifier** — scores credibility by source: `.gov/.edu/.int`
  and standards bodies highest; reputable news next; reference/wikis mid;
  user-generated content lowest (flagged `low-credibility`).
- **IndependentHostCrossChecker** — counts distinct credible hosts; if fewer
  than two, every item is flagged `single-source`.
- **DocIngestor** — turns user text/markdown docs into evidence chunks with
  provenance back to the file (PDF is a documented extension point).

## Anti-fabrication guarantee

Citations come **only** from what a provider actually returned (or a user
document). The model is asked to reason over evidence and cite by index — it
never supplies URLs. The orchestrator builds `verdict.citations` from the
gathered `Evidence`, so a fabricated source cannot reach the user. Test:
`evidence.test.ts` asserts every citation traces to a URL the provider returned.

## Effect on confidence

The Confidence Calibrator lifts the "no external evidence" cap once evidence is
present — but only if it is **corroborated** (≥2 independent credible hosts).
Single-source answers stay below "high" with a stated gap.

## Boundary

The orchestrator depends on `EvidencePort.gather(query) → { evidence,
corroboration, offline }`. Search keys are injected into the provider and never
logged. `offline-fixture` mode is surfaced in the trace and `/health` so a user
always knows whether sources are live.
