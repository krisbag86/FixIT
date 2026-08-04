import { describe, expect, it } from "vitest";
import { formatDateTime, parseAppDateTime } from "@/lib/format";

describe("formatDateTime", () => {
  it("uses the application timezone consistently", () => {
    expect(formatDateTime("2026-07-31T12:00:00.000Z")).toContain("14:00");
  });

  it("parses datetime-local values in the application timezone", () => {
    expect(parseAppDateTime("2026-07-31T14:00").toISOString()).toBe("2026-07-31T12:00:00.000Z");
  });
});
