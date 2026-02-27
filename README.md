# MusicDiscovery

Music discovery web application for exploring related artists and top tracks using public music APIs.

## Status

Work in progress. The portfolio landing page includes a link to this application, and the GitHub Pages deployment workflow is configured to build and publish the app once development is complete.

## Project Structure

Monorepo managed with pnpm workspaces and Turborepo:

```
MusicDiscovery/
├── apps/          # Application packages
├── packages/      # Shared libraries and utilities
├── infra/         # Infrastructure configuration
└── pnpm-workspace.yaml
```

## Technology Stack

- **Package Manager**: pnpm with workspaces
- **Build System**: Turborepo for monorepo orchestration
- **TypeScript**: Shared configuration via tsconfig.base.json
- **Deployment**: Render.com (render.yaml configuration)

## Data Sources

This project uses only public API endpoints to avoid authentication complexity:

- **Deezer API** - Primary source for related artists and top tracks
- **iTunes Search API** - Discovery links and audio previews

No API keys or authentication required.

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Security

No environment variables or API keys are required. Do not commit `.env` files or secrets to this repository.

## Deployment

The GitHub Pages workflow automatically builds and deploys this application to `/MusicDiscovery/` when changes are pushed to the main branch.

---

*Note: This documentation has been formatted and reviewed with assistance from large language models (LLMs) to ensure clarity and professional presentation.*
