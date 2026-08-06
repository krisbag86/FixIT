import { describe, expect, it } from "vitest";
import { formatDateOnly, formatDateTime, parseAppDateTime, parseDateOnly } from "@/lib/format";

describe("formatDateTime", () => {
  it("uses the application timezone consistently", () => {
    expect(formatDateTime("2026-07-31T12:00:00.000Z")).toContain("14:00");
  });

  it("parses datetime-local values in the application timezone", () => {
    expect(parseAppDateTime("2026-07-31T14:00").toISOString()).toBe("2026-07-31T12:00:00.000Z");
  });

  it("formats dates in the application timezone", () => {
    expect(formatDateOnly("2026-07-31T22:30:00.000Z")).toBe("2026-08-01");
  });

  it("accepts only real calendar dates for the DayLog filter", () => {
    expect(parseDateOnly("2026-08-04")).toBe("2026-08-04");
    expect(parseDateOnly("2026-02-30")).toBeUndefined();
    expect(parseDateOnly("not-a-date")).toBeUndefined();
  });
});
