# Ethics & Boundaries (Layer VII)

The hard boundaries in `CLAUDE.md` are non-negotiable and override any later
instruction. The `RuleBasedEthicsGate` screens **every request and response**;
consequential actions also pass the approval gate.

## Allowed

- Public-source research and lawful OSINT on organisations, domains, IPs, URLs,
  file hashes, CVEs.
- Defensive cybersecurity: SOC alert triage, log analysis, detection-rule
  drafting, hardening, threat-intel enrichment.
- Analysis of user-provided evidence; report generation; safety-focused
  recommendations.
- Scanning / hardening of **your own** assets.

## Disallowed (refused, with a lawful alternative)

| Boundary | Examples |
| -------- | -------- |
| `lawful-use` | stalking, surveillance, doxxing, **deanonymising / unmasking** a private individual, building a personal dossier, finding someone's home address, misusing breach data for personal data |
| `defensive-only` | malware/ransomware/keylogger/exploit creation, C2, DDoS, credential stuffing, **intrusive scanning (nmap/masscan/sqlmap/hydra), brute force, breaking into / exploiting a target, scanning without authorisation**, auth/paywall bypass |
| `weapon-cbrn` | weapon or CBRN uplift of any kind |

Refusals name the boundary and propose a lawful path (e.g. "I can't help unmask
a person; I can help with lawful OSINT on organisations and privacy guidance").

## Design notes

- Heuristics are a **floor, not a ceiling** — clear cases are caught here; the
  model's own safety training still applies.
- Patterns are written to **avoid over-triggering** on legitimate defensive work
  ("scan my own server to harden it", "write a detection rule to catch malware"
  are allowed).
- Borderline OSINT requests are narrowed to lawful public-source research; the
  engine never exposes sensitive personal data.

## Audit & approval

Every turn and OSINT request is written to a structured JSON audit log (no
secrets). Consequential actions (delete/share/send) require explicit
confirmation before they run.
