import { describe, it, expect } from 'vitest';
import { run } from '../src/index.js';

describe('Feluda CLI', () => {
  it('shows help with no command', async () => {
    const r = await run([]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/Usage:/);
  });

  it('investigates a question (offline stub)', async () => {
    const r = await run(['investigate', 'why', 'did', 'the', 'service', 'fail?']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/ANSWER/);
    expect(r.out).toMatch(/CONFIDENCE:/);
  });

  it('runs a passive OSINT lookup', async () => {
    const r = await run(['osint', '--target', 'example.com']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/OSINT — domain: example\.com/);
    expect(r.out).toMatch(/\[A\]|\[C\]/);
  });

  it('runs a defensive SOC triage', async () => {
    const r = await run([
      'soc', '--type', 'brute_force',
      '--log', 'Failed password for admin',
      '--log', 'Failed password for admin',
      '--log', 'authentication failure',
      '--log', 'invalid user x',
      '--log', 'Failed login',
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/ASSESSMENT: needs escalation/);
    expect(r.out).toMatch(/RECOMMENDED ACTIONS/);
  });

  it('errors on a missing OSINT target', async () => {
    const r = await run(['osint']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/--target is required/);
  });
});
