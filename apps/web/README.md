# MusicDiscovery Web

Minimal Vite + React shell that consumes the MusicDiscovery API. The search box demonstrates the pluggable provider system by calling the generic `/api/music/search` endpoint with a `provider` override so you can switch between Spotify, the tokenless blend (Deezer + iTunes), or pure iTunes data.

## Scripts

- `pnpm dev` – start Vite on port 5173
- `pnpm build` – type-check and build the production bundle

## Environment

Configure these values for API routing:

- `VITE_API_PREFIX` (default `/api`) – API path prefix.
- `VITE_API_BASE_URL` (optional) – full API origin, for example `https://harounminhas-github-io.onrender.com`.

When `VITE_API_BASE_URL` is omitted, the app automatically uses the Render API origin on `harounminhas.be` and `harounminhas.github.io`. In local development it keeps relative requests so Vite proxying still works.

An example file is available in [`.env.example`](./.env.example).
