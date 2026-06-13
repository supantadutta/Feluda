import { describe, it, expect } from 'vitest';
import {
  FELUDA_CORE_VERSION,
  InterfaceLayer,
  InvestigationCore,
  Council,
  Evidence,
  Memory,
  Action,
  Ethics,
} from '../src/index.js';

/**
 * Smoke test: every layer module imports and exposes its boundary.
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

  it('all 7 layers are implemented (Action performs through the approval gate)', async () => {
    const action = Action.createActionPort();
    const res = await action.perform({ kind: 'ops.task.add', payload: { title: 'review case' } });
    expect(res.ok).toBe(true);
  });
});
