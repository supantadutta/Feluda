/**
 * @feluda/core — public surface.
 *
 * The 7 architecture layers from SPEC.md, each exported as its own namespace so
 * boundaries stay explicit. Phase 0 ships interfaces + placeholders only; layer
 * logic is filled in phase-by-phase (see BUILD_PLAN.md).
 */
export * from './types.js';
export { NotImplementedError } from './util/not-implemented.js';

export * as InterfaceLayer from './layer1-interface/index.js';
export * as InvestigationCore from './layer2-investigation-core/index.js';
export * as Council from './layer3-council/index.js';
export * as Evidence from './layer4-evidence/index.js';
export * as Memory from './layer5-memory/index.js';
export * as Action from './layer6-action/index.js';
export * as Ethics from './layer7-ethics/index.js';
export * as Osint from './osint/index.js';

/** Build/identity marker — handy for the API health check. */
export const FELUDA_CORE_VERSION = '0.1.0';
