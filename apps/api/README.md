# MusicDiscovery API

Express server that exposes music discovery endpoints backed by pluggable providers. Set `DATA_MODE` to `tokenless`, `spotify`, or the new `itunes`-only provider. Individual requests can override the mode with the `provider` query parameter or `x-music-provider` header.

## Endpoints

- `GET /api/providers` – fetch the available provider catalogue and default mode
- `GET /api/music/search` – search for artists (supports `provider` query/header overrides)
- `GET /api/music/artists/:id` – fetch a single artist profile
- `GET /api/music/artists/:id/related` – fetch style- and genre-aligned artists across Deezer and iTunes fallbacks
- `GET /api/music/artists/:id/top-tracks` – fetch an artist's top tracks for the current provider
- `GET /api/music/tracks/:id` – fetch a track by id across providers

## Scripts

- `pnpm dev` – start the API with `tsx`
- `pnpm build` – compile TypeScript into `dist`

## Environment

See [`.env.example`](./.env.example) for all configuration options. The default tokenless mode requires no credentials.
