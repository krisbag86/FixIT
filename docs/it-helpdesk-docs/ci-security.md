# CI i zabezpieczenia zmian

Workflow `.github/workflows/ci.yml` uruchamia dla każdego pushu na `main` i `codex/v1.2` oraz dla każdego pull requesta:

- typecheck, lint, testy jednostkowe i build produkcyjny,
- testy Playwright E2E w izolowanym JSON fixture,
- `npm audit` dla podatności wysokich i krytycznych,
- skan sekretów przez TruffleHog.

Na GitHubie należy ustawić ochronę brancha `main` i wymagać przejścia wszystkich czterech jobów przed merge'em:

- `Typecheck, lint, tests, build`,
- `Playwright E2E`,
- `Dependency audit`,
- `Secret scan`.

Nie należy zezwalać na pomijanie wymaganych status checks ani na bezpośredni push do `main`.
