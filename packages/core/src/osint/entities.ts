/**
 * Entity extraction & link analysis. Pulls technical indicators out of free
 * text (logs, alerts, notes, evidence) deterministically with regexes — no
 * external NLP. Focuses on lawful, technical indicators relevant to OSINT/SOC
 * work; it does NOT attempt to identify or deanonymise private individuals.
 */
import { newId } from '../util/ids.js';
import type { EntityNode, EntityType, InvestigationGraph } from './types.js';

const PATTERNS: { type: EntityType; re: RegExp }[] = [
  { type: 'url', re: /\bhttps?:\/\/[^\s<>"')]+/gi },
  { type: 'email', re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi },
  { type: 'cve', re: /\bCVE-\d{4}-\d{4,7}\b/gi },
  { type: 'file_hash', re: /\b(?:[a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})\b/gi },
  { type: 'ip', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'mitre_technique', re: /\bT\d{4}(?:\.\d{3})?\b/g },
  { type: 'domain', re: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi },
];

const PORT_RE = /\b(?:port\s+|:)(\d{1,5})\b/gi;
const PROTO_RE = /\b(TCP|UDP|HTTP|HTTPS|DNS|SSH|RDP|SMB|FTP|SMTP|TLS|ICMP)\b/gi;

function clean(value: string, type: EntityType): string {
  return type === 'cve' || type === 'mitre_technique' ? value.toUpperCase() : value.toLowerCase();
}

/** Extract distinct technical entities from text. */
export function extractEntities(text: string): EntityNode[] {
  const seen = new Set<string>();
  const nodes: EntityNode[] = [];
  const add = (type: EntityType, raw: string) => {
    const value = clean(raw, type);
    const key = `${type}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({ id: newId('ent'), type, value });
  };

  for (const { type, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      // Skip domains that are really the host part of an already-captured email/url.
      if (type === 'domain' && /[@/]/.test(text[Math.max(0, m.index - 1)] ?? '')) continue;
      add(type, m[0]);
    }
  }
  for (const m of text.matchAll(PORT_RE)) {
    const p = Number(m[1]);
    if (p > 0 && p <= 65535) add('port', String(p));
  }
  for (const m of text.matchAll(PROTO_RE)) add('protocol', m[1]!);
  return nodes;
}

/** Build a simple star graph linking a primary entity to the others observed. */
export function buildGraph(primary: EntityNode | undefined, others: EntityNode[]): InvestigationGraph {
  // De-duplicate by type:value and drop any that duplicate the primary node.
  const seen = new Set<string>(primary ? [`${primary.type}:${primary.value}`] : []);
  const distinct: EntityNode[] = [];
  for (const o of others) {
    const key = `${o.type}:${o.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(o);
  }
  const nodes = primary ? [primary, ...distinct] : distinct;
  const edges = primary ? distinct.map((o) => ({ from: primary.id, to: o.id, kind: 'observed_in' as const })) : [];
  return { nodes, edges };
}
