import { describe, it, expect } from 'vitest';
import {
  classifyTarget,
  extractEntities,
  gradeFromCredibility,
  isStale,
  profileFor,
  OsintEngine,
} from '../src/osint/index.js';

describe('Target classification', () => {
  it('classifies common indicator types (incl. defanged)', () => {
    expect(classifyTarget('example.com').type).toBe('domain');
    expect(classifyTarget('8.8.8.8').type).toBe('ip');
    expect(classifyTarget('user@example.com').type).toBe('email');
    expect(classifyTarget('CVE-2021-44228').type).toBe('cve');
    expect(classifyTarget('44d88612fea8a8f36de82e1278abb02f').type).toBe('file_hash');
    // Defanged URL is refanged before classification.
    const u = classifyTarget('hxxps://evil[.]example[.]com/path');
    expect(u.type).toBe('url');
    expect(u.normalized).toContain('https://evil.example.com');
  });
});

describe('Entity extraction', () => {
  it('pulls technical indicators from text', () => {
    const text =
      'Host 10.0.0.5 contacted bad-domain.com over port 443 (TLS); see CVE-2023-1234 and hash ' +
      'd41d8cd98f00b204e9800998ecf8427e. Mapped to T1059.';
    const types = new Set(extractEntities(text).map((e) => e.type));
    expect(types.has('ip')).toBe(true);
    expect(types.has('domain')).toBe(true);
    expect(types.has('cve')).toBe(true);
    expect(types.has('file_hash')).toBe(true);
    expect(types.has('mitre_technique')).toBe(true);
    expect(types.has('protocol')).toBe(true);
  });
});

describe('Source grading & freshness', () => {
  it('maps credibility to A–F grades', () => {
    expect(gradeFromCredibility(0.95)).toBe('A');
    expect(gradeFromCredibility(0.75)).toBe('B');
    expect(gradeFromCredibility(0.55)).toBe('C');
    expect(gradeFromCredibility(0.35)).toBe('D');
    expect(gradeFromCredibility(0.1)).toBe('F');
  });
  it('treats old sources as stale', () => {
    expect(isStale(500)).toBe(true);
    expect(isStale(10)).toBe(false);
    expect(isStale(undefined)).toBe(false);
  });
});

describe('Passive profiles', () => {
  it('always forbids intrusive/doxxing actions', () => {
    const p = profileFor('domain');
    expect(p.disallowedActions.join(' ')).toMatch(/intrusive|doxx|deanonymis/i);
  });
});

describe('OSINT engine (offline)', () => {
  it('investigates a domain passively and returns graded findings + a graph', async () => {
    const res = await new OsintEngine().investigate('example.com');
    expect(res.target.type).toBe('domain');
    expect(res.offline).toBe(true);
    expect(res.findings.length).toBeGreaterThan(0);
    for (const f of res.findings) expect(['A', 'B', 'C', 'D', 'F']).toContain(f.grade);
    // Graph has the target as primary node.
    expect(res.graph.nodes.some((n) => n.id === 'target')).toBe(true);
    // Honest scope note about offline fixtures.
    expect(res.notes.join(' ')).toMatch(/offline fixtures/i);
  });
});
