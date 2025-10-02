# MusicDiscovery API

Express server that exposes music discovery endpoints backed by pluggable providers. Set `DATA_MODE` to `tokenless`, `spotify`, or the new `itunes`-only provider. Individual requests can override the mode with the `provider` query parameter or `x-music-provider` header.

## Scripts

- `npm run dev` – start the API with `tsx`
- `npm run build` – compile TypeScript into `dist`

## Environment

See [`.env.example`](./.env.example) for all configuration options. The default tokenless mode requires no credentials.
