# Layer VI — Action

Turns conclusions into deliverables and handles daily admin. **Every
consequential action passes through the Layer VII approval gate first.**

## Capabilities (`ActionService` → `ActionPort`)

| Action kind | What it does |
| ----------- | ------------ |
| `report.export` / `report.share` | Build a case report (Markdown / printable HTML) from a Verdict |
| `data.analyze` | Sandbox-safe CSV analysis (per-column stats) + a dependency-free SVG chart |
| `security.triage` | Defensive log triage — flags failed-auth bursts, errors, privilege events |
| `security.detection-rule` | Draft a Sigma-style detection rule (YAML) |
| `security.hardening` | Hardening checklist for a system type |
| `ops.task.add/list/complete/delete` | Daily Ops task store |

Security helpers are **defensive scope only** (CLAUDE.md hard boundary) — they
help a defender detect and harden, never build offensive capability.

## Approval gate (Human-in-the-loop)

`ConsequentialApprovalGate` (Layer VII) names consequential kinds
(`ops.task.delete`, `report.share`, `ops.reminder.send`). When a request targets
one of those, `ActionService.perform` returns:

```json
{ "ok": false, "awaitingApproval": true, "detail": { "message": "… confirm to proceed." } }
```

until `payload.confirmed === true`. The API maps this to HTTP **202 Accepted**
(awaiting approval) vs **200** (done). Non-consequential actions run immediately.

## API

`POST /api/actions { kind, payload }` — dispatches an action; every attempt is
written to the audit log (`action.performed`).

## Data sandbox safety

CSV analysis runs in-process with **no arbitrary code execution** — parsing and
arithmetic only — which keeps it safe by construction and within the boundaries.
