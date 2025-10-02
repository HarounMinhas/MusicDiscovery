import { z } from 'zod';

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().url().optional(),
  genres: z.array(z.string()).optional(),
  popularity: z.number().optional()
});

export type Artist = z.infer<typeof ArtistSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  previewUrl: z.string().url().optional(),
  durationMs: z.number(),
  artists: z.array(z.object({ id: z.string(), name: z.string() }))
});

export type Track = z.infer<typeof TrackSchema>;

export const SearchArtistsResponseSchema = z.object({
  items: z.array(ArtistSchema)
});

export type SearchArtistsResponse = z.infer<typeof SearchArtistsResponseSchema>;

export const RelatedArtistsResponseSchema = z.object({
  items: z.array(ArtistSchema)
});

export type RelatedArtistsResponse = z.infer<typeof RelatedArtistsResponseSchema>;

export const TopTracksResponseSchema = z.object({
  items: z.array(TrackSchema)
});

export type TopTracksResponse = z.infer<typeof TopTracksResponseSchema>;
