import { describe, it, expect } from 'vitest';
import { RemoteEmbedder, InMemoryVectorStore, KnowledgeVault } from '../src/layer5-memory/index.js';

/** Mock /embeddings endpoint: maps known phrases to separable vectors. */
function mockEmbeddings(): { fetchImpl: typeof fetch; auth: () => string } {
  let lastAuth = '';
  const vectorFor = (input: string): number[] => {
    if (/ledger|payment|shell/i.test(input)) return [1, 0, 0];
    if (/lunch|momo|food/i.test(input)) return [0, 1, 0];
    return [0, 0, 1];
  };
  const fetchImpl = (async (_url: string, init?: { headers?: Record<string, string>; body?: string }) => {
    lastAuth = init?.headers?.Authorization ?? '';
    const input = JSON.parse(init?.body ?? '{}').input as string;
    return { ok: true, status: 200, json: async () => ({ data: [{ embedding: vectorFor(input) }] }) } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, auth: () => lastAuth };
}

describe('Remote semantic embedder', () => {
  it('embeds via the configured endpoint and sends the key in the header only', async () => {
    const { fetchImpl, auth } = mockEmbeddings();
    const e = new RemoteEmbedder({ apiKey: 'sk-emb', model: 'text-embedding-3-small', fetchImpl, dim: 3 });
    const v = await e.embed('the ledger payment');
    expect(v).toEqual([1, 0, 0]);
    expect(auth()).toBe('Bearer sk-emb');
  });

  it('powers semantic recall in the Knowledge Vault (async embedder path)', async () => {
    const { fetchImpl } = mockEmbeddings();
    const embedder = new RemoteEmbedder({ apiKey: 'k', model: 'm', fetchImpl, dim: 3 });
    const vault = new KnowledgeVault(new InMemoryVectorStore(embedder));
    await vault.addNote('The ledger lists a payment to a shell company');
    await vault.addNote('Lunch options include momos');

    const hits = await vault.recall('shell company payment', 1);
    expect(hits[0]!.text).toMatch(/ledger/i);
  });
});
