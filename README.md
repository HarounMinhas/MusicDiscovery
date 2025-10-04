# MusicDiscovery Monorepo

This repository contains the complete blueprint for the MusicDiscovery application. It is organised as a TypeScript-first monorepo with separate apps and packages to support both a Spotify-enabled mode and a tokenless public-data mode.

## Structure

```
/apps
  /api          # Node/Express backend
  /web          # React + Vite frontend
/packages
  /providers    # pluggable music data providers
  /shared       # shared DTOs, schemas, provider metadata
  /ui           # (placeholder) design system components
/infra          # deployment and container configuration
```

Additional configuration lives in [`turbo.json`](./turbo.json) and the GitHub workflows under [`.github/workflows`](./.github/workflows).

## Modes

The backend supports three music providers out of the box: `tokenless` (Deezer + iTunes blend), `spotify`, and `itunes` only. The `DATA_MODE` environment variable defines the default provider, while individual requests can override it by passing `?provider=<mode>` or the `x-music-provider` header. See [`apps/api/.env.example`](./apps/api/.env.example) for the configuration surface.

## Run the project locally

Follow these steps on a fresh machine:

```bash
# one-time per machine (works on Windows PowerShell too)
corepack enable
# after cloning the repo:
pnpm --version              # Corepack fetches the pinned pnpm automatically
pnpm install
pnpm dev
```

1. **Install prerequisites**
   - [Node.js 20](https://nodejs.org/) or newer (Corepack ships with Node 20+)
   - Optional: [Docker Desktop](https://www.docker.com/) if you plan to run Redis/PostgreSQL later in the roadmap

2. **Clone the repository and install dependencies**

   ```bash
   git clone https://github.com/<your-org>/MusicDiscovery.git
   cd MusicDiscovery
   corepack enable                               # enables pnpm via Corepack
   pnpm --version                                # downloads the pinned pnpm version
   pnpm install                                  # installs workspace dependencies
   ```

   > ℹ️ A `preinstall` hook blocks `npm install`, so make sure to use pnpm as shown above.

3. **Configure environment variables**
   - Copy the provided examples and adjust as needed:

     ```bash
     cp apps/api/.env.example apps/api/.env
     cp apps/web/.env.example apps/web/.env
     ```

   - For the default `tokenless` mode no credentials are required. If you switch to `spotify`, provide client credentials in `apps/api/.env`.

4. **Start the development servers**
   - Run both the API and the web shell in parallel with Turbo:

     ```bash
     pnpm dev
     ```

   - The API boots on [http://localhost:8080/api](http://localhost:8080/api) and the web client on [http://localhost:5173](http://localhost:5173).

5. **Verify the stack**
   - Check the API health endpoint:

     ```bash
     curl http://localhost:8080/api/health
     ```

   - Open the web client at [http://localhost:5173](http://localhost:5173) and run an artist search. Use the provider switcher in the top-right corner to swap between Spotify, the tokenless blend, or iTunes-only data.

6. **Run individual workspaces (optional)**
   - API only: `pnpm --filter @musicdiscovery/api dev`
   - Web only: `pnpm --filter @musicdiscovery/web dev`

With these steps you can search for artists immediately using the tokenless mode without any secrets.

## Getting help

Each workspace contains its own README with additional context:

- [`apps/api/README.md`](./apps/api/README.md) for backend details
- [`apps/web/README.md`](./apps/web/README.md) for the Vite client

Feel free to open an issue if you encounter problems while setting things up locally.
