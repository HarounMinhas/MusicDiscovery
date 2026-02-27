# MusicDiscovery Architecture Refactor Roadmap

Dit document splitst de volledige architectuurverbetering op in uitvoerbare issues.

## Completed in this branch

- [x] Introduceer een layered start in de web-app (`application`, `domain`, `infrastructure`).
- [x] Introduceer `ArtistRepository` contract + provider registry.
- [x] Vervang handmatige fetch-state voor search/details met TanStack Query caching.
- [x] Introduceer gecentraliseerd error model (`DomainError`, `NetworkError`, `ProviderError`).

## Suggested follow-up issues

### Issue 1 — Split `App.tsx` into context providers
- Maak `ProviderContext`, `SearchContext`, `ArtistContext`, `TabsContext`, `UiContext`.
- Verplaats state + side effects uit `AppInner` naar context boundaries.
- Voeg selector hooks toe om rerenders te beperken.

### Issue 2 — DTO/domain strict separation
- Definieer DTO types in `infrastructure/dto`.
- Voeg mapperlaag toe van DTO -> domain model.
- Houd domain modellen API-onafhankelijk.

### Issue 3 — UI architecture / design tokens
- Introduceer tokens (`color`, `spacing`, `radius`, `motion`).
- Migreer CSS naar component-driven structuur.
- Voeg theming abstraction toe.

### Issue 4 — Error boundaries + logging strategy
- Voeg route-level error boundaries toe.
- Introduceer logging abstraction met provider/context metadata.
- Definieer recoverable vs non-recoverable errors.

### Issue 5 — Advanced delivery concerns
- Feature flag centralisatie.
- Analytics abstraction.
- Lazy route loading + bundle splits.
