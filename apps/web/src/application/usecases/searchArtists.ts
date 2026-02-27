import type { ProviderId } from '@musicdiscovery/shared';
import type { Artist } from '@musicdiscovery/shared';
import { getArtistRepository } from '../providerRegistry';

export async function searchArtistsUseCase(
  provider: ProviderId,
  query: string,
  limit = 10
): Promise<Artist[]> {
  return getArtistRepository(provider).search(query, limit);
}
