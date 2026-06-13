import { describe, it, expect } from 'vitest';
import {
  FELUDA_CORE_VERSION,
  NotImplementedError,
  InterfaceLayer,
  InvestigationCore,
  Council,
  Evidence,
  Memory,
  Action,
  Ethics,
} from '../src/index.js';

/**
 * Phase 0 smoke test: every layer module imports and exposes its boundary, and
 * the not-yet-implemented placeholders fail loudly rather than silently.
 */
describe('core scaffold', () => {
  it('exposes a version marker', () => {
    expect(FELUDA_CORE_VERSION).toBe('0.1.0');
  });

  it('exports all 7 layer namespaces', () => {
    expect(InterfaceLayer.createInterfacePort).toBeTypeOf('function');
    expect(InvestigationCore.createOrchestrator).toBeTypeOf('function');
    expect(Council.createModelGateway).toBeTypeOf('function');
    expect(Evidence.createEvidencePort).toBeTypeOf('function');
    expect(Memory.createMemoryPort).toBeTypeOf('function');
    expect(Action.createActionPort).toBeTypeOf('function');
    expect(Ethics.createEthicsGate).toBeTypeOf('function');
  });

  it('Phase 1 layers are implemented (ethics screens, not a stub)', () => {
    const gate = Ethics.createEthicsGate();
    expect(gate.screenRequest('what is the capital of France?').allowed).toBe(true);
  });

  it('not-yet-built layers still throw NotImplementedError', () => {
    // Layer IV (Evidence) lands in Phase 2.
    const evidence = Evidence.createEvidencePort();
    expect(() => evidence.gather({ id: 'q', text: 'x', receivedAt: '' })).toThrow(
      NotImplementedError,
    );
  });
});
