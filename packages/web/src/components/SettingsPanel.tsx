import { useEffect, useState, type FormEvent } from 'react';
import { settingsApi, type ProviderSettings } from '../api.js';

const PROVIDERS = [
  { id: 'stub', label: 'Offline (no model)', hint: 'Deterministic placeholder — no key needed.' },
  { id: 'anthropic', label: 'Anthropic (Claude)', hint: 'e.g. claude-opus-4-8' },
  { id: 'openai', label: 'OpenAI-compatible', hint: 'OpenAI, OpenRouter, Together, Groq, or local Ollama/LM Studio' },
] as const;

/** Plug in any AI model at runtime: provider, model id, base URL, and key. */
export function SettingsPanel(): JSX.Element {
  const [current, setCurrent] = useState<ProviderSettings | null>(null);
  const [provider, setProvider] = useState('stub');
  const [model, setModel] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const s = await settingsApi.get();
    setCurrent(s);
    setProvider(s.provider);
    setModel(s.model);
    setBaseURL(s.baseURL ?? '');
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function onSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const s = await settingsApi.set({ provider, model: model || undefined, baseURL: baseURL || undefined, apiKey: apiKey || undefined });
      setCurrent(s);
      setApiKey('');
      setStatus(`Saved · mode: ${s.modelMode}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onTest(): Promise<void> {
    setBusy(true);
    setStatus('Testing…');
    try {
      const r = await settingsApi.test();
      setStatus(r.ok ? `✓ ${r.model}: ${r.sample}` : '✗ test failed');
    } catch (err) {
      setStatus(err instanceof Error ? `✗ ${err.message}` : '✗ test failed');
    } finally {
      setBusy(false);
    }
  }

  const selected = PROVIDERS.find((p) => p.id === provider);

  return (
    <section className="max-w-xl space-y-4">
      <div className="rounded-lg border border-cyan-500/30 bg-slate-900/60 p-3 text-sm">
        <div className="text-xs uppercase tracking-widest text-cyan-400">Active model</div>
        <div className="font-mono text-slate-200">
          {current ? `${current.provider} · ${current.model} · ${current.modelMode}` : '…'}
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-400">Provider</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {selected && <span className="mt-1 block text-xs text-slate-500">{selected.hint}</span>}
        </label>

        {provider !== 'stub' && (
          <>
            <label className="block text-sm">
              <span className="text-slate-400">Model id</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-opus-4-8 / gpt-4o-mini / llama3.1" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono" />
            </label>
            {provider === 'openai' && (
              <label className="block text-sm">
                <span className="text-slate-400">Base URL</span>
                <input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://api.openai.com/v1 · http://localhost:11434/v1" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono" />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-slate-400">API key {current?.hasKey && <span className="text-emerald-400">(stored)</span>}</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-… (kept server-side, never returned)" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono" />
            </label>
          </>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium disabled:opacity-50">Save</button>
          <button type="button" onClick={() => void onTest()} disabled={busy} className="rounded-lg border border-cyan-500/40 px-4 py-2 text-sm">Test</button>
        </div>
      </form>
      {status && <div className="rounded border border-slate-700 bg-slate-800/60 p-2 text-xs text-slate-300">{status}</div>}
      <p className="text-xs text-slate-500">Keys are held server-side only and never sent back to the browser.</p>
    </section>
  );
}
