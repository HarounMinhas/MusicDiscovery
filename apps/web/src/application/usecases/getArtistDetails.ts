import type { ProviderId } from '@musicdiscovery/shared';
import type { ArtistDetails } from '../../domain/repositories/ArtistRepository';
import { getArtistRepository } from '../providerRegistry';

export async function getArtistDetailsUseCase(
  provider: ProviderId,
  artistId: string,
  options: { topTrackLimit?: number; relatedLimit?: number } = {}
): Promise<ArtistDetails> {
  return getArtistRepository(provider).getDetails(artistId, options);
}
