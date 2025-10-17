# Contributing to MusicDiscovery

This project is designed to be "Codex-ready". Follow the prompts below when implementing new functionality so that provider contracts, API responses and the front-end remain in sync.

## Repository layout

- `apps/api` – Express backend
- `apps/web` – React + Vite frontend
- `packages/providers` – music data providers (tokenless + Spotify)
- `packages/shared` – shared DTOs and zod schemas
- `packages/ui` – design system primitives

## Implementation prompts

1. **Create provider interface & tokenless/spotify implementations**

   Files:
   - `packages/providers/src/types.ts`
   - `packages/providers/src/Provider.ts`
   - `packages/providers/src/tokenless/index.ts`
   - `packages/providers/src/spotify/index.ts`
   - `packages/providers/src/factory.ts`

2. **API bootstrap**

   Files:
   - `apps/api/src/index.ts`
   - `apps/api/src/env.ts`
   - `apps/api/src/routes/music.ts`
   - `apps/api/src/cache.ts`
   - `apps/api/src/middleware/rateLimit.ts`

3. **Shared schemas**

   Files:
   - `packages/shared/src/schemas.ts`
   - `packages/shared/src/index.ts`

4. **Frontend fetchers and graph UI**

   Files:
   - `apps/web/src/api.ts`
   - `apps/web/src/state/graph.ts`
   - `apps/web/src/components/*`
   - `apps/web/src/pages/*`

5. **Playwright tests (tokenless)**

   - Configure `VITE_API_PREFIX` to match the API prefix handled by the dev proxy.
   - Cover search → related artists → preview playback.

## Operating modes

Set `DATA_MODE=tokenless` to use the Deezer/iTunes provider or `DATA_MODE=spotify` to use the Spotify provider (requires credentials). The routes exposed by the API remain the same across both modes.
