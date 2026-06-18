# SOC Workflows (defensive only)

`SocAnalyzer.analyze(input)` triages a security alert and returns a calibrated,
evidence-based assessment with **defensive-only** recommendations. It is humble:
without confirming evidence it prefers `needs_escalation` or `inconclusive` over
asserting a `true_positive`, and it never recommends counter-attack.

## Supported alert types

`suspicious_login, brute_force, password_spray, phishing_email, suspicious_ip,
suspicious_domain, suspicious_url, malware_hash, web_attack, impossible_travel,
dns_tunneling, lateral_movement`.

## Input → assessment

```
input { type, title?, artifacts?, logs?, context? }
  → extract indicators (entities) + triage logs (failed-auth bursts, errors, privilege)
  → per-type heuristic verdict + confidence + escalate flag
  → defensive recommended actions
```

`SocAssessment` follows the standard SOC format: Alert Summary, Observed
Activity, Investigation Findings, Assessment (`true_positive | false_positive |
benign | needs_escalation | inconclusive`), Reasoning, Recommended Action,
Confidence (`very_high … unknown`), Management Summary.

Examples of calibration:
- A burst of failed authentications → `needs_escalation` (confirm + contain),
  not an unconfirmed "true positive".
- Context noting *authorised/scheduled* activity → `benign`.
- Impossible travel → `needs_escalation` (verify with the user).
- No indicators/logs → `inconclusive` (gather more).

## API

`POST /api/soc/investigate { type, title?, artifacts?, logs?, context? }` →
`{ assessment, report }`. The `report` is the standard SOC analyst report
(`socReport`). Every assessment is written to the audit log.

All recommended actions are defensive and reversible (lock/rate-limit, block at
the perimeter, enforce MFA, isolate a host, apply a WAF rule, verify with the
user). No offensive action is ever suggested (CLAUDE.md hard boundary).
