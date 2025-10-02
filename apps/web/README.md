# MusicDiscovery Web

Minimal Vite + React shell that consumes the MusicDiscovery API. The search box demonstrates the pluggable provider system by calling `/api/spotify/search` with a `provider` override so you can switch between Spotify, the tokenless blend, or pure iTunes data.

## Scripts

- `npm run dev` – start Vite on port 5173
- `npm run build` – type-check and build the production bundle

## Environment

Configure `VITE_API_BASE` to point to the API instance. An example file is available in [`.env.example`](./.env.example).
