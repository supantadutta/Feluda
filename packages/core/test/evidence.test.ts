import { describe, it, expect } from 'vitest';
import {
  SearchEvidencePort,
  HeuristicSourceVerifier,
  IndependentHostCrossChecker,
  DocIngestor,
  type SearchProvider,
  type SearchResult,
} from '../src/layer4-evidence/index.js';
import { createOrchestrator } from '../src/layer2-investigation-core/index.js';
import { StubGateway } from '../src/layer3-council/index.js';
import type { Query } from '../src/types.js';

function query(text: string): Query {
  return { id: 'q', text, receivedAt: new Date().toISOString() };
}

/** A provider whose returned URLs we know exactly — to prove provenance. */
class TwoHostProvider implements SearchProvider {
  readonly name = 'test';
  readonly offline = false;
  async search(): Promise<SearchResult[]> {
    return [
      { title: 'A', url: 'https://www.nist.gov/a', snippet: 'fact A' },
      { title: 'B', url: 'https://en.wikipedia.org/b', snippet: 'fact B' },
    ];
  }
}

class OneHostProvider implements SearchProvider {
  readonly name = 'test1';
  readonly offline = false;
  async search(): Promise<SearchResult[]> {
    return [{ title: 'Only', url: 'https://example-blog.medium.com/x', snippet: 'lone claim' }];
  }
}

describe('Source verifier', () => {
  it('ranks authoritative sources above user-generated ones', async () => {
    const v = new HeuristicSourceVerifier();
    const gov = await v.score({
      id: '1',
      claim: '',
      citation: { source: 'https://nist.gov/x', retrievedAt: '' },
      credibility: 0,
      relevance: 0,
    });
    const blog = await v.score({
      id: '2',
      claim: '',
      citation: { source: 'https://foo.medium.com/x', retrievedAt: '' },
      credibility: 0,
      relevance: 0,
    });
    expect(gov).toBeGreaterThan(blog);
  });
});

describe('Cross-checker', () => {
  it('flags single-source evidence and confirms corroboration with ≥2 hosts', () => {
    const cc = new IndependentHostCrossChecker();
    const corro = cc.report([
      { id: '1', claim: '', citation: { source: 'https://nist.gov/a', retrievedAt: '' }, credibility: 0.9, relevance: 1 },
      { id: '2', claim: '', citation: { source: 'https://who.int/b', retrievedAt: '' }, credibility: 0.9, relevance: 1 },
    ]);
    expect(corro.corroborated).toBe(true);

    const flagged = cc.flag([
      { id: '1', claim: '', citation: { source: 'https://nist.gov/a', retrievedAt: '' }, credibility: 0.9, relevance: 1 },
    ]);
    expect(flagged[0]!.flags).toContain('single-source');
  });
});

describe('Doc ingest', () => {
  it('turns a markdown doc into evidence with provenance back to the file', () => {
    const ev = new DocIngestor().ingest({
      name: 'notes.md',
      mime: 'text/markdown',
      content: 'First finding.\n\nSecond finding.',
    });
    expect(ev).toHaveLength(2);
    expect(ev[0]!.citation.source).toBe('notes.md');
  });
});

describe('Evidence → loop integration (no fabricated citations)', () => {
  it('every citation traces to a source the provider actually returned', async () => {
    const port = new SearchEvidencePort(new TwoHostProvider());
    const orch = createOrchestrator({ gateway: new StubGateway(), evidence: port });
    const verdict = await orch.investigate(query('what is X?'));

    const allowed = new Set(['https://www.nist.gov/a', 'https://en.wikipedia.org/b']);
    expect(verdict.citations.length).toBeGreaterThan(0);
    for (const c of verdict.citations) expect(allowed.has(c.source)).toBe(true);
  });

  it('single-source evidence keeps confidence below "high"', async () => {
    const port = new SearchEvidencePort(new OneHostProvider());
    const orch = createOrchestrator({ gateway: new StubGateway(), evidence: port });
    const verdict = await orch.investigate(query('lone question?'));
    expect(verdict.confidence.band).not.toBe('high');
    expect(verdict.confidence.gaps.join(' ')).toMatch(/corroborat/i);
  });
});
