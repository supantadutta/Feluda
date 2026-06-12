import { buildServer } from './server.js';
import { loadConfig } from './config.js';

/** Entry point — starts the Feluda API server. */
async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer(config);
  try {
    await app.listen({ port: config.apiPort, host: '0.0.0.0' });
    app.log.info(`Feluda API listening on http://localhost:${config.apiPort}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
