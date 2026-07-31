import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";

describe("formatDateTime", () => {
  it("uses the application timezone consistently", () => {
    expect(formatDateTime("2026-07-31T12:00:00.000Z")).toContain("14:00");
  });
});
