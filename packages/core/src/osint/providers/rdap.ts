/**
 * Live RDAP provider (keyless, public, passive). RDAP is the modern,
 * authoritative successor to WHOIS for domain and IP registration data. It is a
 * read-only public lookup — no probing, no scanning. Findings cite the exact
 * RDAP endpoint queried, so provenance is real (never fabricated).
 */
import { newId } from '../../util/ids.js';
import { gradeFromCredibility } from '../grading.js';
import type { OsintFinding, OsintTarget, OsintTargetType } from '../types.js';
import type { OsintProvider } from '../providers.js';

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}
interface RdapResponse {
  ldhName?: string;
  handle?: string;
  name?: string;
  startAddress?: string;
  endAddress?: string;
  events?: RdapEvent[];
  entities?: { roles?: string[]; handle?: string }[];
}

export interface RdapConfig {
  /** Base RDAP bootstrap endpoint. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class RdapProvider implements OsintProvider {
  readonly name = 'rdap';
  readonly mode = 'live' as const;
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: RdapConfig = {}) {
    this.base = config.baseUrl ?? 'https://rdap.org';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  supports(type: OsintTargetType): boolean {
    return type === 'domain' || type === 'ip';
  }

  async investigate(target: OsintTarget): Promise<OsintFinding[]> {
    const path = target.type === 'ip' ? `ip/${target.normalized}` : `domain/${target.normalized}`;
    const url = `${this.base}/${path}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`RDAP lookup failed (${res.status})`);
    const data = (await res.json()) as RdapResponse;

    const findings: OsintFinding[] = [];
    const registration = data.events?.find((e) => e.eventAction === 'registration')?.eventDate;
    const freshnessDays = registration ? daysSince(registration) : undefined;

    if (target.type === 'domain') {
      findings.push(
        fact(`Domain ${data.ldhName ?? target.normalized} is registered${registration ? `, since ${registration}` : ''}.`, url, freshnessDays),
      );
    } else {
      const range = data.startAddress && data.endAddress ? ` (range ${data.startAddress}–${data.endAddress})` : '';
      findings.push(fact(`IP ${target.normalized} belongs to network "${data.name ?? data.handle ?? 'unknown'}"${range}.`, url, freshnessDays));
    }
    return findings;
  }
}

function fact(claim: string, source: string, freshnessDays?: number): OsintFinding {
  const credibility = 0.92; // RDAP registry data is authoritative
  return {
    id: newId('rdap'),
    claim,
    citation: { source, title: 'RDAP registry', retrievedAt: new Date().toISOString() },
    credibility,
    relevance: 0.9,
    grade: gradeFromCredibility(credibility),
    category: 'fact',
    freshnessDays,
  };
}

function daysSince(iso: string): number | undefined {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 86_400_000)) : undefined;
}
