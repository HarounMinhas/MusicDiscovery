import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ProviderRegistryModule = typeof import('../providerRegistry.js');

const ORIGINAL_ENV = { ...process.env };

async function loadRegistry(): Promise<ProviderRegistryModule> {
  return import('../providerRegistry.js');
}

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key as keyof NodeJS.ProcessEnv];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('provider registry', () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('omits spotify metadata when the provider is disabled', async () => {
    process.env.SPOTIFY_ENABLED = 'false';
    const { getProviderMetadata } = await loadRegistry();

    expect(getProviderMetadata().map((p) => p.id)).not.toContain('spotify');
  });

  it('includes spotify metadata when the provider is enabled', async () => {
    process.env.SPOTIFY_ENABLED = 'true';
    const { getProviderMetadata } = await loadRegistry();

    expect(getProviderMetadata().map((p) => p.id)).toContain('spotify');
  });

  it('falls back to tokenless when default mode is unavailable', async () => {
    process.env.SPOTIFY_ENABLED = 'false';
    process.env.DATA_MODE = 'spotify';
    const { getDefaultProviderMode } = await loadRegistry();

    expect(getDefaultProviderMode()).toBe('tokenless');
  });
});
