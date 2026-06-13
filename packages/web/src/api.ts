import type { Verdict } from '@feluda/core';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export type { Verdict };

/** Submit a question to the deduction loop and return the transparent verdict. */
export async function investigate(question: string): Promise<Verdict> {
  const res = await fetch(`${BASE_URL}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as Verdict;
}
