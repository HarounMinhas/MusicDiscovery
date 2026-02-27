import { z } from 'zod';

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageUrl: z.string().url().optional(),
  genres: z.array(z.string()).optional(),
  popularity: z.number().optional(),
  // Issue #85: UX label / explainability (additive)
  uxLabel: z.string().min(1).optional(),
  uxSource: z.string().min(1).optional()
});

export type Artist = z.infer<typeof ArtistSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  previewUrl: z.string().url().optional(),
  previewProxyUrl: z
    .union([z.string().url(), z.string().startsWith('/')])
    .optional(),
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

export const SmartRelatedStrategySchema = z.enum(['deezer-related', 'fallback-members-aggregation']);

export const DeezerSmartArtistSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  link: z.string().url().optional(),
  picture: z.string().url().optional(),
  picture_small: z.string().url().optional(),
  picture_medium: z.string().url().optional(),
  picture_big: z.string().url().optional(),
  picture_xl: z.string().url().optional(),
  nb_fan: z.number().optional(),
  // Issue #85: UX label / explainability (additive)
  uxLabel: z.string().min(1).optional(),
  uxSource: z.string().min(1).optional()
});

export const SmartRelatedResponseSchema = z.object({
  query: z.string(),
  strategy: SmartRelatedStrategySchema,
  items: z.array(DeezerSmartArtistSchema),
  seeds: z.array(z.string()).optional(),
  cache: z.object({ hit: z.boolean() }),
  tookMs: z.number()
});

export type SmartRelatedResponse = z.infer<typeof SmartRelatedResponseSchema>;

export const TopTracksResponseSchema = z.object({
  items: z.array(TrackSchema)
});

export type TopTracksResponse = z.infer<typeof TopTracksResponseSchema>;
