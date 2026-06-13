import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { App } from './App.js';

/** Phase 1 smoke test: the chat shell renders with an input. */
describe('App', () => {
  afterEach(cleanup);

  it('renders the Feluda heading and a question input', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Feluda' })).toBeDefined();
    expect(screen.getByLabelText('Ask Feluda')).toBeDefined();
  });
});
