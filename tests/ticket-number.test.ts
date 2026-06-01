import { describe, expect, it } from "vitest";
import { generateTicketNumber } from "@/lib/ticket-number";

describe("generateTicketNumber", () => {
  it("uses IT-YYYY-NNNN format", () => {
    expect(generateTicketNumber(2026, 1)).toBe("IT-2026-0001");
    expect(generateTicketNumber(2026, 42)).toBe("IT-2026-0042");
  });
});
