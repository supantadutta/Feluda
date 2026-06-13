/**
 * Audit & Approval (Layer VII) — a structured JSON audit trail. Every turn is
 * recorded. Secrets must NEVER be written here; callers pass only non-secret
 * detail (CLAUDE.md — Privacy by default).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditEntry } from '../types.js';
import type { AuditLog } from './index.js';

/** Build a timestamped entry. */
export function auditEntry(event: string, detail: Record<string, unknown> = {}): AuditEntry {
  return { at: new Date().toISOString(), event, detail };
}

/** In-memory audit log — the default; ideal for tests and inspection. */
export class InMemoryAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}

/**
 * File-backed audit log — appends one JSON object per line (JSONL) under a
 * directory, and keeps an in-memory mirror. Used by the API server.
 */
export class FileAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];
  private readonly file: string;

  constructor(dir = join(process.cwd(), 'data', 'audit')) {
    mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    this.file = join(dir, `feluda-${day}.jsonl`);
  }

  record(entry: AuditEntry): void {
    this.entries.push(entry);
    appendFileSync(this.file, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
