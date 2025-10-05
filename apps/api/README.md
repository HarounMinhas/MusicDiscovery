# MusicDiscovery API

Express server that exposes music discovery endpoints backed by pluggable providers. Set `DATA_MODE` to `tokenless`, `spotify`, or the new `itunes`-only provider. Individual requests can override the mode with the `provider` query parameter or `x-music-provider` header.

## Endpoints

- `GET /api/providers` – fetch the available provider catalogue and default mode
- `GET /api/music/search` – search for artists (supports `provider` query/header overrides)
- `GET /api/music/artists/:id` – fetch a single artist profile
- `GET /api/music/artists/:id/related` – fetch style- and genre-aligned artists across Deezer and iTunes fallbacks
- `GET /api/music/artists/:id/top-tracks` – fetch an artist's top tracks for the current provider
- `GET /api/music/tracks/:id` – fetch a track by id across providers
- `GET /api/deezer/related-smart` – Deezer related artists with optional MusicBrainz band-member fallback

## Scripts

- `pnpm dev` – start the API with `tsx`
- `pnpm build` – compile TypeScript into `dist`

## Environment

See [`.env.example`](./.env.example) for all configuration options. The default tokenless mode requires no credentials.

## Smart Related (Deezer + MusicBrainz Fallback)

The `/api/deezer/related-smart` endpoint first looks up related artists directly from Deezer. When the feature flag
`SMART_RELATED_ENABLED` is turned on, callers can opt into a fallback strategy via `useFallback=true` which queries
MusicBrainz for matching bands, expands their members, maps those members back to Deezer and aggregates their related
artists. Responses include the resolution strategy, cache hinting and execution timing so clients can adapt behaviour.
Set `SMART_RELATED_MUSICBRAINZ_USER_AGENT` to a descriptive identifier with contact information and optionally tune
`SMART_RELATED_MUSICBRAINZ_RATE_LIMIT_MS` (defaults to 1000ms) to respect the MusicBrainz API's 1 request/second
guidance.
