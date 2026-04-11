import { createApp } from './app.js';
import { loadRuntimeConfig } from './env.js';

const {
  upstreamBaseUrl,
  upstreamApiKey,
  port,
  maxSessions,
} = loadRuntimeConfig();

const app = createApp({
  upstreamBaseUrl,
  upstreamApiKey,
  maxSessions,
});

app.server.listen(port, '0.0.0.0', () => {
  console.log(`claude-raw-proxy listening on http://0.0.0.0:${port}`);
  console.log(`debug inspector at http://0.0.0.0:${port}/debug`);
  console.log(`upstream base ${upstreamBaseUrl}`);
});
