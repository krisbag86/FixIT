# Auth and Security Requirements

## 1. Podstawowe wymaganie

Do aplikacji moga logowac sie tylko uzytkownicy z adresem email w domenie:

```text
bagietka.pl
```

Dozwolone:

```text
jan.kowalski@bagietka.pl
sklep.waw01@bagietka.pl
it@bagietka.pl
```

Niedozwolone:

```text
jan@gmail.com
jan@bagietka.com
jan@bagietka.pl.evil.com
jan@it.bagietka.pl
```

Subdomeny, np. `user@it.bagietka.pl`, sa odrzucone w MVP, chyba ze pozniej zostanie jawnie podjeta inna decyzja.

## 2. Normalizacja emaila

Przed walidacja email musi byc:

- przyciety z bialych znakow,
- zamieniony na lowercase.

Przyklad:

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

## 3. Walidacja domeny

```ts
export function isAllowedBagietkaEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();

  const parts = normalized.split("@");
  if (parts.length !== 2) return false;

  return parts[1] === "bagietka.pl";
}
```

## 4. Wymagania serwerowe

Walidacja domeny musi byc wymuszona po stronie serwera.

Frontendowa walidacja jest tylko dla UX i nie moze byc jedyna ochrona.

Wymuszenie powinno wystepowac w:

- logowaniu,
- rejestracji / auto-provisioningu uzytkownika,
- OAuth / SSO callback,
- zaproszeniach lub tworzeniu uzytkownikow przez admina.

## 5. Role

Role:

- `REPORTER`,
- `STORE_MANAGER`,
- `AGENT`,
- `ADMIN`.

Sam fakt posiadania emaila `@bagietka.pl` nie daje uprawnien admina.

Uprawnienia wynikaja z rekordu uzytkownika w bazie danych.

## 6. Permission matrix

| Akcja | REPORTER | STORE_MANAGER | AGENT | ADMIN |
|---|---:|---:|---:|---:|
| Utworzenie ticketu | yes | yes | yes | yes |
| Widok wlasnych ticketow | yes | yes | yes | yes |
| Widok ticketow sklepu | no | yes | yes | yes |
| Widok wszystkich ticketow | no | no | yes | yes |
| Zmiana statusu | no | no | yes | yes |
| Przypisanie wykonawcy | no | no | yes | yes |
| Komentarz publiczny | yes | yes | yes | yes |
| Notatka wewnetrzna | no | no | yes | yes |
| Zarzadzanie uzytkownikami | no | no | no | yes |
| Zarzadzanie sklepami | no | no | no | yes |
| Zarzadzanie kategoriami | no | no | no | yes |
| Zarzadzanie FAQ | no | no | no | yes |

## 7. Testy domeny

```ts
describe("isAllowedBagietkaEmail", () => {
  it("allows bagietka.pl email", () => {
    expect(isAllowedBagietkaEmail("jan@bagietka.pl")).toBe(true);
  });

  it("allows uppercase after normalization", () => {
    expect(isAllowedBagietkaEmail("JAN@BAGIETKA.PL")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isAllowedBagietkaEmail(" jan@bagietka.pl ")).toBe(true);
  });

  it("rejects gmail", () => {
    expect(isAllowedBagietkaEmail("jan@gmail.com")).toBe(false);
  });

  it("rejects similar domain", () => {
    expect(isAllowedBagietkaEmail("jan@bagietka.com")).toBe(false);
  });

  it("rejects malicious suffix", () => {
    expect(isAllowedBagietkaEmail("jan@bagietka.pl.evil.com")).toBe(false);
  });

  it("rejects subdomains by default", () => {
    expect(isAllowedBagietkaEmail("jan@it.bagietka.pl")).toBe(false);
  });
});
```

## 8. Dodatkowe rekomendacje

- Wymusic HTTPS w produkcji.
- Ustawic secure cookies.
- Nie logowac tokenow i hasel.
- Ograniczyc rate limit logowania.
- Dla adminow rozwazyc MFA.
- Zapisywac audit log dla zmian statusu, roli i uprawnien.
