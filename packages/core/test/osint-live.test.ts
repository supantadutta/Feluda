import { describe, it, expect } from 'vitest';
import { RdapProvider, DnsProvider, createOsintEngine } from '../src/osint/index.js';
import { classifyTarget } from '../src/osint/index.js';

/** A fetch stub returning canned JSON, recording the URL queried. */
function stubFetch(payload: unknown, ok = true): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(String(url));
    return { ok, status: ok ? 200 : 500, json: async () => payload } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
}

describe('RDAP provider (live, mocked)', () => {
  it('parses domain registration and cites the RDAP endpoint', async () => {
    const { fetchImpl, urls } = stubFetch({
      ldhName: 'example.com',
      events: [{ eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' }],
    });
    const provider = new RdapProvider({ fetchImpl });
    const findings = await provider.investigate(classifyTarget('example.com'));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.claim).toMatch(/registered/);
    expect(findings[0]!.grade).toBe('A');
    // Citation is the exact endpoint queried — real provenance, not fabricated.
    expect(findings[0]!.citation.source).toBe(urls[0]);
    expect(urls[0]).toContain('/domain/example.com');
  });

  it('parses IP network ownership', async () => {
    const { fetchImpl } = stubFetch({ name: 'GOOGLE', startAddress: '8.8.8.0', endAddress: '8.8.8.255' });
    const findings = await new RdapProvider({ fetchImpl }).investigate(classifyTarget('8.8.8.8'));
    expect(findings[0]!.claim).toMatch(/GOOGLE/);
  });
});

describe('DNS-over-HTTPS provider (live, mocked)', () => {
  it('returns A records cited to the DoH endpoint', async () => {
    const { fetchImpl } = stubFetch({ Answer: [{ name: 'example.com', type: 1, data: '93.184.216.34' }] });
    const findings = await new DnsProvider({ fetchImpl }).investigate(classifyTarget('example.com'));
    expect(findings.some((f) => /A records/.test(f.claim))).toBe(true);
    expect(findings[0]!.citation.source).toContain('dns.google');
  });
});

describe('createOsintEngine', () => {
  it('uses offline fixtures by default and live providers when requested', async () => {
    expect((await createOsintEngine().investigate('example.com')).offline).toBe(true);
    // live engine has providers but no network here — that is a runtime concern,
    // construction must not throw.
    expect(createOsintEngine({ live: true })).toBeDefined();
  });
});
