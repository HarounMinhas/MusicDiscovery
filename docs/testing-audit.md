# Test-audit (MusicDiscovery)

## 1) Welke testen falen op dit moment?

Uitvoering:

```bash
pnpm test
```

Resultaat: alleen `@musicdiscovery/web` faalt. De API- en provider-tests slagen.

Falende web-tests:

- `apps/web/src/cache/__tests__/artistCache.test.ts` (4 tests)
- `apps/web/src/hooks/__tests__/useArtistDetails.test.tsx` (3 tests)
- `apps/web/src/__tests__/related-navigation.test.tsx` (1 test)

Gezamenlijke foutmelding:

- `TypeError: Cannot set property testPath of #<Object> which has only a getter`

Werkhypothese (waarschijnlijk): incompatibiliteit tussen de test-tooling in `apps/web`.
- Web gebruikt `vitest@^1.6.1`.
- Web laadt ook `@testing-library/jest-dom` via `vitest.setup.ts`.
- In lockfile staat `@testing-library/jest-dom@6.9.1`; in de web-package staat een brede range (`^6.4.2`).

Dat patroon (oude Vitest + recente jest-dom) kan leiden tot runtime setup-fouten die alle tests tegelijk raken.

## 2) Soorten testen in deze repo

### Providers (`packages/providers`)

- **Type**: unit tests, pure module-tests.
- **Focus**:
  - HTTP client gedrag (headers, timeout, retries, JSON parsing).
  - Concurrency-limiting in tokenless provider.
- **I/O**: geen echte netwerkcalls; `global.fetch` en modulefuncties worden gemockt.

### API (`apps/api`)

- **Type**: lichte integratie-tests rond Express-routes + service-unit tests.
- **Focus**:
  - Routecontracten en statuscodes (`supertest` tegen in-memory Express app).
  - Caching/provider-registry/logging utility-gedrag.
  - Fallback-/smart-related service-orkestratie met gemockte dependencies.
- **I/O**: geen echte externe calls in tests; afhankelijkheden worden met `vi.mock`, `vi.spyOn` en `vi.stubGlobal('fetch', ...)` gedummied.

### Web (`apps/web`)

- **Type**: component/hook unit tests in `jsdom`.
- **Focus**:
  - Cache-semantiek.
  - Hook-gedrag voor artiest-details.
  - Navigatiegedrag in React UI.
- **I/O**: hooks/API calls worden gemockt, maar test-runtime faalt nu vroeg in setup vóór inhoudelijke assertions.

## 3) Wat hebben deze testen nodig?

### Runtime/testframework

- Monorepo test-runner via Turbo (`turbo run test`).
- Vitest per package.
- Voor web: `jsdom` + setup file (`apps/web/vitest.setup.ts`).

### Node/platform

- Repo verwacht Node 20 (`>=20 <21`).
- Web-tests gebruiken browserachtige globals (zoals `window`, `localStorage`, `requestAnimationFrame`).

### Isolatie

- Veel tests resetten state expliciet (`vi.resetModules`, `clearCache`, `window.localStorage.clear`, env reset).
- API-routetests maken eigen app-instantie per test/context.

## 4) Externe API-calls dummien: huidige aanpak + aanbevelingen

## Huidige aanpak (goed)

- `global.fetch` mocken met `vi.fn()`/`vi.stubGlobal` (providers en API).
- Service-modules mocken met `vi.mock(...)` (API service tests).
- Route-tests sturen alleen interne HTTP-verzoeken via `supertest`.

## Aanbevolen verbetering

1. **Één standaard mocking-strategie voor HTTP kiezen**
   - Nu mix van `global.fetch = ...` en `vi.stubGlobal('fetch', ...)`.
   - Kies één stijl (bij voorkeur `vi.stubGlobal`) en centraliseer helpers.

2. **Contract-fixtures toevoegen**
   - Bewaar representatieve API payloads als fixtures (bijv. JSON bestanden).
   - Vermindert handmatige inline objecten en maakt regressies zichtbaarder.

3. **MSW overwegen voor web/API-grens**
   - Zeker voor web-componenttests: realistischer request-flow met minder brittle mocks.

4. **Fail-fast guard op echte netwerkcalls**
   - In test setup: throw wanneer `fetch` niet expliciet gemockt is.
   - Voorkomt trage/flaky tests door onbedoelde externe requests.

## 5) Optimalisaties specifiek voor falende web-tests

1. **Compatibiliteit vastzetten**
   - Pin `@testing-library/jest-dom` op een versie die bewezen samenwerkt met Vitest 1.x, of upgrade Vitest zodat de combinatie officieel ondersteund is.

2. **Setup minimaliseren**
   - Houd `vitest.setup.ts` klein (alleen noodzakelijke setup) om globale side-effects te beperken.

3. **Hook-tests alignen met huidige implementatie**
   - `useArtistDetails` gebruikt nu `@tanstack/react-query`; tests zouden idealiter een `QueryClientProvider` wrapper gebruiken i.p.v. oude fetch-only verwachtingen.

4. **Web-tests per file serialiseren bij timer-heavy cases (optioneel)**
   - Als fake timers en async rendering elkaar beïnvloeden, kun je voor die suites concurrency beperken.

## 6) Praktische volgende stap

- Eerst de web test-tooling mismatch oplossen (Vitest/jest-dom combi).
- Daarna `apps/web` tests opnieuw draaien.
- Pas daarna inhoudelijke refactors doen aan hook-tests (QueryClient wrapper + mockstrategie harmoniseren).
