/**
 * Tolerant JSON extraction. Models are asked for pure JSON, but occasionally
 * wrap it in prose or code fences. We pull the outermost object and parse it.
 * On failure we throw — callers convert that into an honest, low-confidence
 * verdict rather than guessing (calibrated honesty, CLAUDE.md).
 */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

/** Clamp a number into the 0..1 range; non-finite becomes 0. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
