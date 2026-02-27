import type { ProviderId } from '@musicdiscovery/shared';
import type { ArtistRepository } from '../domain/repositories/ArtistRepository';
import { HttpArtistRepository } from '../infrastructure/repositories/HttpArtistRepository';

const registry = new Map<ProviderId, ArtistRepository>();

export function getArtistRepository(provider: ProviderId): ArtistRepository {
  const existing = registry.get(provider);
  if (existing) {
    return existing;
  }

  const repository = new HttpArtistRepository(provider);
  registry.set(provider, repository);
  return repository;
}
