/**
 * OSINT module — lawful, passive, public-source investigation.
 *
 * Target classification, entity extraction & link analysis, A–F source grading,
 * passive investigation profiles, provider adapters (offline fixtures + live),
 * and the engine that ties them together. The Investigation Core (Layer II)
 * consumes OSINT findings as evidence; Layer VII enforces the boundaries.
 */
export * from './types.js';
export { classifyTarget, refang } from './targets.js';
export { extractEntities, buildGraph } from './entities.js';
export { gradeFromCredibility, freshnessScore, isStale } from './grading.js';
export { profileFor } from './profiles.js';
export { OfflineOsintProvider, type OsintProvider } from './providers.js';
export { RdapProvider, type RdapConfig } from './providers/rdap.js';
export { DnsProvider, type DnsConfig } from './providers/dns.js';
export { OsintEngine, createOsintEngine, type OsintEngineConfig } from './engine.js';
