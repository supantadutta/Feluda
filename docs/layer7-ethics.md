# Layer VII — Ethics & Trust

A standing boundary over every other layer. In Phase 1 it ships the request/
response gate and the audit trail.

## Ethics gate (`RuleBasedEthicsGate`)

Rule-based, explainable screening enforced on every turn:

- `screenRequest(text)` — runs on the inbound question, before any model call.
- `screenResponse(text)` — runs on the generated answer, before it reaches the
  user.

It returns a `GateDecision`. When blocked it names the **boundary** and proposes
a **lawful alternative** (a CLAUDE.md requirement).

| Boundary | Catches | Alternative offered |
| -------- | ------- | ------------------- |
| `lawful-use` | stalking, surveillance, doxxing, private-data digging | lawful/public info, privacy guidance |
| `defensive-only` | building malware/exploits/C2, DDoS, auth bypass | detection, hardening, log triage |
| `weapon-cbrn` | weapon / CBRN uplift | safety-focused public science education |

Heuristics are a **floor, not a ceiling** — they catch clear cases; the model's
own safety training still applies. `screenResponse` re-checks only the hard-harm
categories (weapon/CBRN, offensive cyber) to avoid over-triggering on benign
prose. Refusals never call the model and never gather evidence.

## Audit & Approval

A structured JSON trail (`AuditEntry`). **Secrets are never written** — callers
pass only non-secret detail.

- `InMemoryAuditLog` — default; used in tests.
- `FileAuditLog` — appends one JSON object per line to `data/audit/feluda-<date>.jsonl`; used by the API.

Events recorded per turn: `query.received`, `request.screened`,
`request.refused` / `response.refused`, `verdict.produced`.

The approval gate for consequential **actions** (Layer VI) lands in Phase 5.

## Secrets

API keys are read only by the API server's config and injected into the gateway.
They never appear in prompts, the audit log, server logs (Fastify redaction), or
the client.
