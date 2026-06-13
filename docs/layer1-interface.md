# Layer I — Interface

How the user reaches Feluda. Phase 1 shipped chat + the API; Phase 7 adds the
Case Dashboard, scheduled Briefings, voice mode, and an installable PWA.

## Surfaces

- **Chat** — runs the deduction loop; each answer renders via `VerdictView`
  (answer, confidence, reasoning trace, hypotheses, citation trail, council,
  self-review flags).
- **Case Dashboard** — `Dashboard` renders the session's investigations as an
  **evidence board**, a **timeline** (every reasoning step), and a **link-graph**
  (`LinkGraph` — a question node linked to hypotheses and citations).
- **Briefings** — `BriefingScheduler` (core) runs a digest investigation per
  topic on an interval. Deterministic `runDue(now)` for tests; the API drives it
  on a real 60s interval and exposes `POST /api/briefings`, `GET /api/briefings`,
  `POST /api/briefings/:id/run`.
- **Voice** — `useVoice` uses the browser Web Speech API: dictate questions
  (STT) and read answers aloud (TTS). Degrades gracefully when unsupported; no
  audio leaves the device.
- **API / CLI** — REST endpoints across all layers (see each layer's doc).

## PWA

`vite-plugin-pwa` generates the manifest + service worker; `public/icon.svg` is
the installable icon. The app is offline-capable for its shell and installable
to the home screen.

## Boundaries

The interface depends only on `InterfacePort.ask(turn) → Verdict` (wrapping the
orchestrator) and the REST API. It holds no secrets and renders only what the
loop returns — reasoning, confidence, and provenance are always visible.
