import type { ProviderId } from '@musicdiscovery/shared';
import { NetworkError, ProviderError } from '../../domain/errors/AppErrors';
import { getSelectedProvider } from '../../providerSelection';

const apiPrefix = (import.meta.env.VITE_API_PREFIX ?? '/api').replace(/\/$/, '');

export async function request<T>(
  path: string,
  options: { includeProvider?: boolean; provider?: ProviderId } = {}
): Promise<T> {
  const url = new URL(path, 'http://placeholder.local');
  const provider = options.provider ?? getSelectedProvider();

  if (options.includeProvider !== false) {
    url.searchParams.set('provider', provider);
  }

  let response: Response;
  try {
    response = await fetch(`${apiPrefix}${url.pathname}${url.search}`);
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : 'Network request failed');
  }

  if (!response.ok) {
    const text = await response.text();
    const message = text || `Request failed: ${response.status}`;
    if (response.status >= 500) {
      throw new ProviderError(message, provider);
    }
    throw new NetworkError(message, response.status);
  }

  return response.json() as Promise<T>;
}
