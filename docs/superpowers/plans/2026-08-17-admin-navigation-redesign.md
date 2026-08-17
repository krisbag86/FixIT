# Admin Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the IT panel navigation around prominent DayLog/Grafik tools and a dedicated `/admin/settings` tile page.

**Architecture:** Keep existing routes, permission checks, and page content unchanged. Refactor `AdminNav` into grouped primary/operational/settings links, add a server-rendered settings page that filters tiles using existing permissions, and verify behavior with focused unit tests plus Playwright coverage.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Playwright.

## Global Constraints

- Preserve all existing URLs and server actions.
- Preserve existing role permissions; settings tiles must not grant access.
- Keep the existing responsive horizontal-scroll behavior on small screens.
- Do not modify the main user navigation outside the IT panel.
- Keep `.freebuff/` untracked and untouched.

---

### Task 1: Group the IT panel navigation

**Files:**
- Modify: `components/admin/admin-nav.tsx`
- Test: `tests/admin-nav.test.tsx`

**Interfaces:**
- Consumes: `AdminNav({ user, currentPath }: { user: User; currentPath: string })`.
- Produces: grouped navigation with `DayLog` and `Grafik` in the operational group and `/admin/settings` as the settings entry.

- [ ] **Step 1: Write failing tests for menu grouping and active state**

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminNav } from "@/components/admin/admin-nav";

const admin = { id: "u1", name: "Admin", email: "admin@bagietka.pl", role: "ADMIN", isActive: true } as const;

describe("AdminNav", () => {
  it("groups settings routes behind one settings link", () => {
    const html = renderToStaticMarkup(<AdminNav user={admin} currentPath="/admin/users" />);
    expect(html).toContain("Ustawienia");
    expect(html).not.toContain(">Użytkownicy<");
    expect(html).not.toContain(">Sklepy<");
    expect(html).not.toContain(">Szablony<");
    expect(html).toContain('href="/admin/settings"');
    expect(html).toContain('aria-current="page"');
  });

  it("keeps DayLog and Grafik visible as operational tools", () => {
    const html = renderToStaticMarkup(<AdminNav user={admin} currentPath="/admin/daylog" />);
    expect(html).toContain("DayLog");
    expect(html).toContain("Grafik");
    expect(html).toContain("Narzędzia operacyjne");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- tests/admin-nav.test.tsx`

Expected: FAIL because the current flat menu has no `Ustawienia` group or operational-group label.

- [ ] **Step 3: Implement the grouped navigation**

Define three link collections in `components/admin/admin-nav.tsx`: primary links, operational links (`/admin/daylog`, `/admin/schedule`), and a single `/admin/settings` link. Render group labels with `aria-label`/visible text, apply a mint-tinted class to operational links, and make `/admin/settings` active for `/admin/settings` plus `/admin/reports`, `/admin/users`, `/admin/stores`, `/admin/categories`, and `/admin/templates`.

- [ ] **Step 4: Run focused tests and lint**

Run: `npm run test -- tests/admin-nav.test.tsx` and `npm run lint`

Expected: PASS with no lint warnings.

- [ ] **Step 5: Commit the navigation change**

```bash
git add components/admin/admin-nav.tsx tests/admin-nav.test.tsx
git commit -m "refactor: group IT panel navigation"
```

### Task 2: Add the settings tile page

**Files:**
- Create: `app/admin/settings/page.tsx`
- Create: `components/admin/settings-tile.tsx`
- Test: `tests/admin-settings.test.tsx`

**Interfaces:**
- Consumes: `requireUser()`, `canUseAdmin()`, `can()`, `AppShell`, and `AdminNav`.
- Produces: `/admin/settings` with the `Raporty`, `Użytkownicy`, `Sklepy`, `Kategorie`, and `Szablony` links filtered by the existing role permissions.

- [ ] **Step 1: Write failing tests for tile filtering**

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsTile } from "@/components/admin/settings-tile";

describe("SettingsTile", () => {
  it("renders a labelled link with description", () => {
    const html = renderToStaticMarkup(
      <SettingsTile href="/admin/reports" label="Raporty" description="Metryki i SLA." />
    );
    expect(html).toContain('href="/admin/reports"');
    expect(html).toContain("Raporty");
    expect(html).toContain("Metryki i SLA.");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test -- tests/admin-settings.test.tsx`

Expected: FAIL because `SettingsTile` does not exist.

- [ ] **Step 3: Implement the reusable tile and settings page**

Create a typed `SettingsTile` accepting `{ href: string; label: string; description: string; icon: LucideIcon }`. In the page, require an IT-panel user, define tile metadata, render Reports when `can(user, "ticket:view-all")`, and render the other four tiles only for `user.role === "ADMIN"`. Use `AppShell`, `AdminNav currentPath="/admin/settings"`, a heading, and responsive `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` cards with focus-visible rings and a chevron.

- [ ] **Step 4: Run focused tests and build**

Run: `npm run test -- tests/admin-settings.test.tsx`, `npm run typecheck`, and `npm run lint`

Expected: PASS; the new route appears in the Next.js route manifest.

- [ ] **Step 5: Commit the settings page**

```bash
git add app/admin/settings/page.tsx components/admin/settings-tile.tsx tests/admin-settings.test.tsx
git commit -m "feat: add admin settings tile page"
```

### Task 3: Add browser coverage and verify the redesign

**Files:**
- Create: `tests/e2e/admin-navigation.spec.ts`
- Modify: `tests/e2e/helpers.ts` only if a stable navigation helper is needed

**Interfaces:**
- Consumes: the grouped `AdminNav` and `/admin/settings` page from Tasks 1–2.
- Produces: browser evidence that admin and agent views preserve role filtering and active states.

- [ ] **Step 1: Write E2E coverage**

```ts
test("admin sees grouped navigation and all settings tiles", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Raporty/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Użytkownicy/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sklepy/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Szablony/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Kategorie/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ustawienia" })).toHaveAttribute("aria-current", "page");
});

test("agent sees reports but not admin-only settings tiles", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/settings");
  await expect(page.getByRole("link", { name: /Raporty/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Użytkownicy/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Sklepy/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Szablony/ })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the focused E2E tests**

Run: `FIXIT_DATA_PROVIDER=json FIXIT_E2E=true npm run test:e2e -- tests/e2e/admin-navigation.spec.ts`

Expected: PASS for both role scenarios.

- [ ] **Step 3: Run the full verification suite**

Run sequentially: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, then `FIXIT_DATA_PROVIDER=json FIXIT_E2E=true npm run test:e2e`.

Expected: all commands exit 0; no changes are made to `.freebuff/`.

- [ ] **Step 4: Commit and push the complete redesign**

```bash
git status --short
git add app/admin/settings components/admin/admin-nav.tsx components/admin/settings-tile.tsx tests/admin-nav.test.tsx tests/admin-settings.test.tsx tests/e2e/admin-navigation.spec.ts
git commit -m "feat: reorganize admin navigation"
git push origin main
```
