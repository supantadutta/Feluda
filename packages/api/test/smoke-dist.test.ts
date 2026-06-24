import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist', 'index.js');

/**
 * Guards the deployable build: the BUNDLED artifact must boot on plain Node
 * (no tsx) and serve /health. This catches runtime bundling failures (e.g. the
 * dynamic-require regression). Skips when dist isn't built; CI builds first.
 */
describe('deployable build (node dist)', () => {
  it.skipIf(!existsSync(dist))('boots the bundled server and serves /health', async () => {
    const port = 3199;
    const proc = spawn('node', [dist], { env: { ...process.env, API_PORT: String(port), NODE_ENV: 'test' }, stdio: 'pipe' });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += String(d)));

    try {
      let ok = false;
      for (let i = 0; i < 30 && !ok; i++) {
        await sleep(200);
        if (proc.exitCode !== null) break; // crashed
        try {
          const res = await fetch(`http://localhost:${port}/health`);
          if (res.ok) ok = true;
        } catch {
          /* not up yet */
        }
      }
      expect(stderr, stderr).not.toMatch(/Dynamic require|ERR_MODULE_NOT_FOUND|Cannot find/);
      expect(ok).toBe(true);
    } finally {
      proc.kill('SIGKILL');
    }
  }, 15000);
});
