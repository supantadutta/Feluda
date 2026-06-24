import type { Verdict, Osint, Soc, Cases } from '@feluda/core';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export type { Verdict };
export type OsintResult = Osint.OsintResult;
export type SocAssessment = Soc.SocAssessment;
export type SocAlertType = Soc.SocAlertType;
export type CaseRecord = Cases.CaseRecord;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? detail.refusal?.lawfulAlternative ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Run the deduction loop on a free-text question. */
export function investigate(question: string): Promise<Verdict> {
  return post<Verdict>('/api/investigate', { question });
}

/** Passive OSINT investigation of an indicator. */
export function osintInvestigate(target: string): Promise<OsintResult> {
  return post<OsintResult>('/api/osint/investigate', { target });
}

/** Defensive SOC alert triage. */
export function socInvestigate(input: {
  type: SocAlertType;
  title?: string;
  context?: string;
  logs?: string[];
  artifacts?: string[];
}): Promise<{ assessment: SocAssessment; report: { content: string } }> {
  return post('/api/soc/investigate', input);
}

export interface ProviderSettings {
  provider: 'anthropic' | 'openai' | 'stub';
  model: string;
  baseURL: string | null;
  hasKey: boolean;
  modelMode: string;
}

export const settingsApi = {
  get: () => get<ProviderSettings>('/api/settings/provider'),
  set: (s: { provider: string; model?: string; baseURL?: string; apiKey?: string }) =>
    post<ProviderSettings>('/api/settings/provider', s),
  test: () => post<{ ok: boolean; model?: string; sample?: string }>('/api/settings/provider/test', {}),
};

export interface LearningReport {
  labels: string[];
  baselineAccuracy: number;
  rounds: { round: number; trainedTotal: number; accuracy: number }[];
  finalAccuracy: number;
  improvement: number;
}

export const learningApi = {
  run: (rounds = 5) => post<{ report: LearningReport }>('/api/learning/run', { rounds }),
};

export const casesApi = {
  list: () => get<{ cases: CaseRecord[] }>('/api/cases'),
  create: (title: string, objective?: string) => post<{ case: CaseRecord }>('/api/cases', { title, objective }),
  get: (id: string) => get<{ case: CaseRecord }>(`/api/cases/${id}`),
  investigate: (id: string, question: string) =>
    post<{ case: CaseRecord; verdict: Verdict }>(`/api/cases/${id}/investigate`, { question }),
  report: (id: string, type = 'osint_case') => get<{ report: { content: string } }>(`/api/cases/${id}/report?type=${type}`),
};
