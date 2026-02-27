# MusicDiscovery

MusicDiscovery is een webapp waarmee je snel nieuwe muziek kunt ontdekken.
Je zoekt op een artiest en krijgt daarna direct vergelijkbare artiesten te zien, met daarbij hun populairste nummers.
Zo kun je makkelijk van de ene artiest doorklikken naar de volgende en stap voor stap nieuwe muziek vinden.

## Wat de applicatie doet

De app is bedoeld voor mensen die niet precies weten waar ze moeten beginnen, maar wel iets nieuws willen luisteren.
In plaats van eindeloos zoeken krijg je meteen suggesties die aansluiten op wat je al kent.

Kort gezegd:

- je kiest een artiest
- de app laat vergelijkbare artiesten zien
- per artiest zie je de bekendste tracks
- waar mogelijk kun je previews of links openen om direct te luisteren

## Status

Dit project is nog in ontwikkeling.
De basis staat en de deployment workflow is al ingericht, maar het project wordt nog verder verbeterd.

## Projectstructuur

Dit is een monorepo met pnpm workspaces en Turborepo:

```text
MusicDiscovery/
├── apps/          # Applicaties
├── packages/      # Gedeelde code en utilities
├── infra/         # Infrastructuur en deployment configuratie
└── pnpm-workspace.yaml
```

## Technologie

- Package manager: pnpm met workspaces
- Build en orchestration: Turborepo
- Taal: TypeScript met gedeelde basisconfiguratie
- Deployment: Render via `render.yaml`

## Databronnen

De app gebruikt publieke API's, zodat je geen API keys hoeft te beheren.

- Deezer API: bron voor vergelijkbare artiesten en toptracks
- iTunes Search API: links en audio previews

## Lokale ontwikkeling

### Vereisten

- Node.js 18+
- pnpm 8+

### Starten

```bash
# Dependencies installeren
pnpm install

# Development server starten
pnpm dev

# Productiebuild maken
pnpm build
```

## Security

Voor dit project zijn geen secrets of API keys nodig.
Commit geen `.env` bestanden of andere gevoelige gegevens naar deze repository.

## Deployment

- De broncode in deze repository is leidend.
- Deploy target is `HarounMinhas/harounminhas.github.io` in de map `MusicDiscovery/`.
- Deployment start automatisch na een push naar `main`.

## Build notes (Render)

Render-builds gebruiken production-only dependencies en genereren standaard geen DTS-bestanden voor packages. Dit houdt deploys sneller en vermindert onnodig build-werk in CI.

Als je wel DTS-bestanden nodig hebt (bijv. lokaal of voor type-distributie), run dan:

```bash
pnpm -r build:dts
```

Of per package, bijvoorbeeld:

```bash
pnpm --filter @musicdiscovery/shared build:dts
pnpm --filter @musicdiscovery/providers build:dts
```
