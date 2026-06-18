import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OsintPanel } from './OsintPanel.js';
import { SocPanel } from './SocPanel.js';
import { CasesPanel } from './CasesPanel.js';

// CasesPanel fetches on mount; stub fetch so the render is deterministic.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ cases: [] }) })) as unknown as typeof fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Dashboard panels render', () => {
  it('OSINT panel shows a target input and passive-only note', () => {
    render(<OsintPanel />);
    expect(screen.getByLabelText('OSINT target')).toBeDefined();
    expect(screen.getByText(/Passive, public-source only/i)).toBeDefined();
  });

  it('SOC panel shows the alert type selector and defensive note', () => {
    render(<SocPanel />);
    expect(screen.getByLabelText('Alert type')).toBeDefined();
    expect(screen.getByText(/Defensive triage only/i)).toBeDefined();
  });

  it('Cases panel shows the create form', () => {
    render(<CasesPanel />);
    expect(screen.getByLabelText('New case title')).toBeDefined();
  });
});
