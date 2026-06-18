/**
 * Timeline Reconstruction (Layer II). Extracts dated events from free text
 * (logs, alerts, notes, evidence) deterministically. Handles ISO timestamps and
 * common log formats; ambiguous or missing dates are kept with an `uncertainty`
 * note rather than guessed.
 */
import type { TimelineEntry } from './types.js';

// ISO-8601 (with optional time/zone), and "YYYY-MM-DD HH:MM:SS".
const ISO = /\b(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?)\b/;
// Syslog-style "Mon DD HH:MM:SS".
const SYSLOG = /\b([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\b/;
const RELATIVE = /\b(yesterday|today|last night|this morning|earlier|recently)\b/i;

function tzOf(stamp: string): string | undefined {
  const m = stamp.match(/(Z|[+-]\d{2}:?\d{2})$/);
  return m ? m[1] : undefined;
}

/** Build timeline entries from text — one per line that carries an event. */
export function buildTimeline(text: string, source?: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const iso = line.match(ISO);
    const sys = !iso ? line.match(SYSLOG) : null;
    const rel = !iso && !sys ? line.match(RELATIVE) : null;

    if (iso) {
      const at = iso[1]!.replace(' ', 'T');
      entries.push({ at, tz: tzOf(iso[1]!), event: stripStamp(line, iso[1]!), source });
    } else if (sys) {
      entries.push({
        event: stripStamp(line, sys[1]!),
        source,
        uncertainty: 'syslog timestamp has no year; absolute date inferred from context',
      });
    } else if (rel) {
      entries.push({ event: line, source, uncertainty: `relative date ("${rel[1]}") — exact time unknown` });
    }
  }
  // Sort entries that have absolute timestamps; undated ones keep input order at the end.
  return entries.sort((a, b) => {
    if (a.at && b.at) return a.at.localeCompare(b.at);
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
}

function stripStamp(line: string, stamp: string): string {
  return line.replace(stamp, '').replace(/^[\s\-:—|]+/, '').trim() || line;
}
