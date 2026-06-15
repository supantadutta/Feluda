/**
 * OSINT provider adapters. Offline mode uses deterministic fixtures so the
 * engine runs without network or keys; live adapters (WHOIS/RDAP, DNS,
 * reputation, threat-intel) slot in behind the same interface and are gated by
 * environment keys. All providers are PASSIVE — they look up public information
 * and never probe, scan, or exploit a target.
 */
import { newId } from '../util/ids.js';
import { gradeFromCredibility } from './grading.js';
import type { OsintFinding, OsintTarget, OsintTargetType } from './types.js';

export interface OsintProvider {
  readonly name: string;
  readonly mode: 'offline' | 'live';
  supports(type: OsintTargetType): boolean;
  investigate(target: OsintTarget): Promise<OsintFinding[]>;
}

function finding(
  claim: string,
  source: string,
  credibility: number,
  category: OsintFinding['category'],
  freshnessDays?: number,
): OsintFinding {
  return {
    id: newId('osint'),
    claim,
    citation: { source, title: source, retrievedAt: new Date().toISOString() },
    credibility,
    relevance: 0.8,
    grade: gradeFromCredibility(credibility),
    category,
    freshnessDays,
    flags: ['offline-fixture'],
  };
}

/**
 * Deterministic offline provider. Returns clearly-labelled fixture findings per
 * target type so the OSINT pipeline is exercisable end-to-end without network.
 * Feluda never presents fixtures as live authoritative findings (the
 * offline-fixture flag and engine notes make this explicit).
 */
export class OfflineOsintProvider implements OsintProvider {
  readonly name = 'offline-fixture';
  readonly mode = 'offline' as const;

  supports(): boolean {
    return true;
  }

  async investigate(target: OsintTarget): Promise<OsintFinding[]> {
    const v = target.normalized;
    switch (target.type) {
      case 'domain':
        return [
          finding(`Registration metadata for ${v} would come from WHOIS/RDAP.`, 'rdap://registry', 0.9, 'fact', 30),
          finding(`Public reputation feeds list no adverse category for ${v} (fixture).`, 'https://reputation.example/feed', 0.55, 'claim', 10),
        ];
      case 'ip':
        return [
          finding(`Network owner / ASN for ${v} would come from RDAP.`, 'rdap://rir', 0.9, 'fact', 30),
          finding(`No adverse reputation recorded for ${v} (fixture).`, 'https://reputation.example/ip', 0.55, 'claim', 5),
        ];
      case 'file_hash':
        return [
          finding(`Public reputation for hash ${v} (fixture): no known-malware match.`, 'https://malware-repute.example', 0.7, 'claim', 1),
        ];
      case 'cve':
        return [
          finding(`Advisory metadata for ${v} would come from NVD/vendor advisories.`, 'https://nvd.nist.gov/', 0.95, 'fact', 60),
        ];
      case 'url':
        return [
          finding(`URL reputation for ${v} (fixture): not categorised as malicious.`, 'https://url-repute.example', 0.55, 'claim', 2),
        ];
      default:
        return [
          finding(`General public-source research would be run for "${v}".`, 'https://search.example', 0.5, 'claim'),
        ];
    }
  }
}
