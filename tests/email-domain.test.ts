import { describe, expect, it } from "vitest";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";

describe("isAllowedBagietkaEmail", () => {
  it("normalizes email", () => {
    expect(normalizeEmail(" JAN@BAGIETKA.PL ")).toBe("jan@bagietka.pl");
  });

  it("allows exact bagietka.pl domain", () => {
    expect(isAllowedBagietkaEmail("jan@bagietka.pl")).toBe(true);
    expect(isAllowedBagietkaEmail(" JAN@BAGIETKA.PL ")).toBe(true);
  });

  it("rejects external and deceptive domains", () => {
    expect(isAllowedBagietkaEmail("jan@gmail.com")).toBe(false);
    expect(isAllowedBagietkaEmail("jan@bagietka.com")).toBe(false);
    expect(isAllowedBagietkaEmail("jan@bagietka.pl.evil.com")).toBe(false);
    expect(isAllowedBagietkaEmail("jan@it.bagietka.pl")).toBe(false);
    expect(isAllowedBagietkaEmail("janbagietka.pl")).toBe(false);
  });
});
