# OSINT Engine (lawful, passive)

Feluda's OSINT engine reasons over **public and user-provided** information only.
It is **passive**: it looks up public records and reputation, it never probes,
scans, exploits, scrapes private accounts, doxxes, or deanonymises individuals.
These limits are profile-encoded and enforced by Layer VII.

## Pipeline

```
classify target → select passive providers → grade sources (A–F) → extract entities → graph + honest notes
```

- **Target classification** (`classifyTarget`) — detects domain / ip / url /
  email / username / file_hash / cve / phone / organization, with defang support
  (`hxxp`, `[.]`, `(at)`).
- **Profiles** (`profileFor`) — per target type: allowed public sources, the
  enrichment strategy, and a non-negotiable `disallowedActions` list (intrusive
  scanning, exploitation, credential attacks, doxxing, deanonymisation,
  harassment).
- **Providers** (`OsintProvider`) — `OfflineOsintProvider` (deterministic
  fixtures, default) and live adapters (WHOIS/RDAP, DNS, reputation, threat-intel)
  behind the same interface, gated by env keys.
- **Source grading** (`gradeFromCredibility`) — A (authoritative) … F (unusable),
  plus freshness/staleness. Blogs, forums, screenshots, and social posts are
  never strong evidence unless corroborated.
- **Entity extraction & graph** (`extractEntities`, `buildGraph`) — pulls
  technical indicators (IP, domain, URL, email, hash, CVE, port, protocol, MITRE
  technique) and links them to the target.
- **Epistemic categories** — every finding is tagged fact / claim / inference /
  assumption / speculation / unknown; the final answer must never blur them.

## Offline vs live

Default is offline fixtures (no keys, fully testable). `OsintResult.offline` and
the `notes` make this explicit, so a fixture is never mistaken for a live
authoritative finding. Set provider keys to enable live lookups.

## API

- `POST /api/osint/investigate { target, type? }` — passive investigation;
  screened by Ethics first (deanonymisation/intrusive misuse → 403 + lawful
  alternative).
- `POST /api/osint/extract-entities { text }` — indicators from free text.

## Adding a provider

Implement `OsintProvider` (`name`, `mode`, `supports`, `investigate`), return
`OsintFinding[]` with a real `citation` (never fabricated) and a credibility the
grader can map. Pass instances to `new OsintEngine({ providers })`.
