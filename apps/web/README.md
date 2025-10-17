# MusicDiscovery Web

Minimal Vite + React shell that consumes the MusicDiscovery API. The search box demonstrates the pluggable provider system by calling the generic `/api/music/search` endpoint with a `provider` override so you can switch between Spotify, the tokenless blend (Deezer + iTunes), or pure iTunes data.

## Scripts

- `pnpm dev` – start Vite on port 5173
- `pnpm build` – type-check and build the production bundle

## Environment

Configure `VITE_API_PREFIX` to match the API prefix you want proxied by Vite. An example file is available in [`.env.example`](./.env.example).
