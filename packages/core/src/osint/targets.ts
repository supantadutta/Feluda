/**
 * Target classification. Detects what kind of indicator the user supplied and
 * normalises it. Handles common "defanged" forms (hxxp, [.]) so analysts can
 * paste indicators safely.
 */
import type { OsintTarget, OsintTargetType } from './types.js';

const RE = {
  ipv4: /^(?:\d{1,3}\.){3}\d{1,3}$/,
  hash: /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i,
  cve: /^cve-\d{4}-\d{4,7}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^[a-z][a-z0-9+.-]*:\/\//i,
  domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
  username: /^@?[a-z0-9_.]{2,30}$/i,
  phone: /^\+?[0-9][0-9\s().-]{6,}$/,
};

/** Refang an indicator: hxxp→http, [.]→. , (dot)→. so detection works. */
export function refang(value: string): string {
  return value
    .trim()
    .replace(/\[\.\]|\(dot\)|\{dot\}/gi, '.')
    .replace(/\[:\]/g, ':')
    .replace(/^h(xx|XX)p/i, 'http')
    .replace(/\[@\]|\(at\)/gi, '@');
}

/** Classify a free-form indicator into a typed, normalised OSINT target. */
export function classifyTarget(input: string, hint?: OsintTargetType): OsintTarget {
  const value = input.trim();
  const refanged = refang(value);
  const lower = refanged.toLowerCase();

  const detect = (): OsintTargetType => {
    if (hint && hint !== 'unknown') return hint;
    if (RE.cve.test(refanged)) return 'cve';
    if (RE.url.test(refanged)) return 'url';
    if (RE.email.test(refanged)) return 'email';
    if (RE.ipv4.test(refanged)) return 'ip';
    if (RE.hash.test(refanged)) return 'file_hash';
    if (RE.domain.test(refanged)) return 'domain';
    if (refanged.startsWith('@') || (RE.username.test(refanged) && !refanged.includes('.'))) return 'username';
    if (RE.phone.test(refanged)) return 'phone';
    return 'unknown';
  };

  const type = detect();
  const normalized =
    type === 'cve' || type === 'file_hash'
      ? lower
      : type === 'domain' || type === 'email' || type === 'url'
        ? lower.replace(/\/+$/, '')
        : type === 'phone'
          ? refanged.replace(/[\s().-]/g, '')
          : refanged;
  return { type, value, normalized };
}
