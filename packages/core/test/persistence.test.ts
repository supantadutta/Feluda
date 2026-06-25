import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeedbackStore, PatternLibrary } from '../src/layer5-memory/index.js';

describe('Adaptive-learning persistence', () => {
  it('persists feedback preferences across instances', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feluda-fb-')), 'feedback.json');
    new FeedbackStore(undefined, path).add('always prefer primary government sources');

    const reloaded = new FeedbackStore(undefined, path);
    expect(reloaded.size).toBe(1);
    expect(reloaded.relevant('which sources to trust', 1)[0]!.text).toMatch(/primary government/);
  });

  it('persists playbooks across instances', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'feluda-pb-')), 'playbooks.json');
    new PatternLibrary(path).save({ caseType: 'phishing', triggers: ['phish', 'email'], seedHypotheses: ['benign', 'malicious'] });

    const reloaded = new PatternLibrary(path);
    expect(reloaded.match('is this phishing email malicious?')?.caseType).toBe('phishing');
  });
});
