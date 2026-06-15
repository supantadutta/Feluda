/**
 * OSINT Engine. Classifies a target, runs the passive providers that support
 * it, grades the findings, extracts entities into an investigation graph, and
 * returns a structured, honestly-scoped result. It does NO reasoning verdicts
 * itself — the Investigation Core (Layer II) consumes these findings as evidence.
 */
import { classifyTarget } from './targets.js';
import { profileFor } from './profiles.js';
import { extractEntities, buildGraph } from './entities.js';
import { OfflineOsintProvider, type OsintProvider } from './providers.js';
import type { EntityNode, OsintResult, OsintTarget, OsintTargetType } from './types.js';

export interface OsintEngineConfig {
  providers?: OsintProvider[];
}

export class OsintEngine {
  private readonly providers: OsintProvider[];

  constructor(config: OsintEngineConfig = {}) {
    this.providers = config.providers ?? [new OfflineOsintProvider()];
  }

  async investigate(input: string, hint?: OsintTargetType): Promise<OsintResult> {
    const target: OsintTarget = classifyTarget(input, hint);
    const profile = profileFor(target.type);

    const supporting = this.providers.filter((p) => p.supports(target.type));
    const findings = (await Promise.all(supporting.map((p) => p.investigate(target)))).flat();
    const offline = supporting.length === 0 || supporting.every((p) => p.mode === 'offline');

    // Entity graph: primary target node + entities mentioned in the findings.
    const primary: EntityNode | undefined = entityForTarget(target);
    const mentioned = findings.flatMap((f) => extractEntities(f.claim));
    const graph = buildGraph(primary, mentioned);

    const notes = [
      `Passive, public-source investigation of a ${target.type} target.`,
      `Allowed: ${profile.allowedSources.join(', ')}.`,
      `Never: ${profile.disallowedActions.slice(0, 3).join('; ')}.`,
    ];
    if (offline) notes.push('Results are offline fixtures — set live provider keys for real lookups.');
    if (target.type === 'unknown') notes.push('Target type could not be classified; scope is limited.');

    return { target, findings, graph, offline, notes };
  }
}

function entityForTarget(target: OsintTarget): EntityNode | undefined {
  const map: Partial<Record<OsintTargetType, EntityNode['type']>> = {
    domain: 'domain',
    ip: 'ip',
    url: 'url',
    email: 'email',
    username: 'username',
    organization: 'organization',
    file_hash: 'file_hash',
    cve: 'cve',
  };
  const type = map[target.type];
  return type ? { id: 'target', type, value: target.normalized } : undefined;
}
