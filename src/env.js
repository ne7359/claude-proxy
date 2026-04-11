import fs from 'node:fs';
import path from 'node:path';

function parseEnvText(envText) {
  const parsed = {};

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  return parseEnvText(fs.readFileSync(envPath, 'utf8'));
}

function parseNumber(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export function loadRuntimeConfig({
  env = process.env,
  cwd = process.cwd(),
  envPath = path.join(cwd, '.env'),
  envText,
} = {}) {
  const fileValues = envText == null ? readEnvFile(envPath) : parseEnvText(envText);
  const merged = {
    ...fileValues,
    ...env,
  };

  const upstreamBaseUrl = merged.UPSTREAM_BASE_URL?.trim();
  const upstreamApiKey = merged.UPSTREAM_API_KEY?.trim();

  if (!upstreamBaseUrl || !upstreamApiKey) {
    throw new Error(
      `Missing required configuration. Set UPSTREAM_BASE_URL and UPSTREAM_API_KEY in ${envPath} or the environment.`,
    );
  }

  return {
    upstreamBaseUrl,
    upstreamApiKey,
    port: parseNumber(merged.PORT, 8788),
    maxSessions: parseNumber(merged.MAX_SESSIONS, 200),
  };
}
