import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { App } from './App.js';

/** Phase 0 smoke test: the web shell renders. */
describe('App', () => {
  afterEach(cleanup);

  it('renders the Feluda heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Feluda' })).toBeDefined();
  });
});
