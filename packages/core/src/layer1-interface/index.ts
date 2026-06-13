/**
 * Layer I — Interface (boundary module)
 * ─────────────────────────────────────
 * How the user reaches Feluda: chat & voice, the case dashboard, briefings, and
 * the API/CLI. This module owns the *contract* the interface uses to talk to the
 * Orchestrator (Layer II); concrete transports (HTTP, web UI) live in @feluda/api
 * and @feluda/web.
 *
 * Phase: chat UI + this port land in Phase 1; dashboard/briefings/voice in Phase 7.
 */
import type { Query, Verdict } from '../types.js';
import type { Orchestrator } from '../layer2-investigation-core/index.js';

/** A turn submitted by the user through any interface surface. */
export interface ChatTurn {
  query: Query;
  /** Optional prior turns for context (full memory arrives in Phase 3). */
  history?: ChatTurn[];
}

/** The boundary the interface layer depends on to run an investigation. */
export interface InterfacePort {
  /** Submit a user turn and receive a transparent verdict. */
  ask(turn: ChatTurn): Promise<Verdict>;
}

/** Wrap an Orchestrator as the interface boundary the API/CLI talk to. */
export function createInterfacePort(orchestrator: Orchestrator): InterfacePort {
  return {
    ask: (turn) => orchestrator.investigate(turn.query),
  };
}
