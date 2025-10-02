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

1. **Install prerequisites**
   - [Node.js 20+](https://nodejs.org/) (includes npm)
   - Optional: [Docker Desktop](https://www.docker.com/) if you plan to run Redis/PostgreSQL later in the roadmap

2. **Clone the repository and install dependencies**

   ```bash
   git clone https://github.com/<your-org>/MusicDiscovery.git
   cd MusicDiscovery
   npm install
   ```

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
     npm run dev
     ```

   - The API boots on [http://localhost:8080/api](http://localhost:8080/api) and the web client on [http://localhost:5173](http://localhost:5173).

5. **Select a provider at runtime**
   - Use the provider switcher in the top-right corner of the web UI to swap between Spotify, the tokenless blend, or iTunes-only data. The choice is persisted locally and forwarded to every API request.

6. **Run individual workspaces (optional)**
   - API only: `npm run dev -- --filter=@musicdiscovery/api`
   - Web only: `npm run dev -- --filter=@musicdiscovery/web`

With these steps you can search for artists immediately using the tokenless mode without any secrets.

## Getting help

Each workspace contains its own README with additional context:

- [`apps/api/README.md`](./apps/api/README.md) for backend details
- [`apps/web/README.md`](./apps/web/README.md) for the Vite client

Feel free to open an issue if you encounter problems while setting things up locally.
