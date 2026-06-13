import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryPort, LocalEmbedder, FileVectorStore, KnowledgeVault } from '../src/layer5-memory/index.js';
import { createOrchestrator } from '../src/layer2-investigation-core/index.js';
import { StubGateway } from '../src/layer3-council/index.js';
import type { Query } from '../src/types.js';

function query(text: string, caseId?: string): Query {
  return { id: 'q_' + Math.random().toString(36).slice(2), text, caseId, receivedAt: '' };
}

describe('Knowledge Vault', () => {
  it('recalls a note by semantic/lexical overlap', async () => {
    const vault = createMemoryPort();
    await vault.addNote('The Kathmandu ledger lists a payment to a shell company in 1971.');
    await vault.addNote('Lunch options near the office include momos and thukpa.');

    const hits = await vault.recall('ledger shell company payment', 1);
    expect(hits[0]!.text).toMatch(/ledger/i);
  });

  it('persists across instances (file-backed store is swappable)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feluda-mem-'));
    const path = join(dir, 'store.json');

    const a = new KnowledgeVault(new FileVectorStore(new LocalEmbedder(), path));
    await a.addNote('Remember: the suspect drives a blue Ambassador car.');

    const b = new KnowledgeVault(new FileVectorStore(new LocalEmbedder(), path));
    const hits = await b.recall('what car does the suspect drive', 1);
    expect(hits[0]!.text).toMatch(/Ambassador/);
  });
});

describe('Memory in the loop', () => {
  it('recalls an earlier case on a follow-up question', async () => {
    const memory = createMemoryPort();
    const orch = createOrchestrator({ gateway: new StubGateway(), memory });

    // First investigation is written to Case Memory...
    await orch.investigate(query('Who painted the forged Tagore canvas in the Jodhpur case?'));

    // ...a later, related question should recall it (trace records the recall).
    const followUp = await orch.investigate(query('Remind me about the Jodhpur forged Tagore canvas.'));
    const recalledStep = followUp.trace.find((s) => /Recalled \d+ relevant item/.test(s.summary));
    expect(recalledStep).toBeDefined();
  });
});
