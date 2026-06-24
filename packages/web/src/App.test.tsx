import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { App } from './App.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ provider: 'stub', modelMode: 'offline-stub', evidenceMode: 'offline-fixture' }) })) as unknown as typeof fetch,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Phase 1 smoke test: the chat shell renders with an input. */
describe('App', () => {
  it('renders the Feluda banner and a question input', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /feluda/i })).toBeDefined();
    expect(screen.getByLabelText('Ask Feluda')).toBeDefined();
  });
});
