import { describe, expect, it } from "vitest";
import { addScheduleDays, getScheduleWeekDays, resolveScheduleWeekStart } from "@/lib/schedule";

describe("schedule date helpers", () => {
  it("normalizes every day, including Sunday, to the same Monday", () => {
    expect(resolveScheduleWeekStart("2026-08-10")).toBe("2026-08-10");
    expect(resolveScheduleWeekStart("2026-08-15")).toBe("2026-08-10");
    expect(resolveScheduleWeekStart("2026-08-16")).toBe("2026-08-10");
  });

  it("returns a complete Monday-to-Sunday range", () => {
    expect(getScheduleWeekDays("2026-08-10")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16"
    ]);
  });

  it("adds days across month and year boundaries", () => {
    expect(addScheduleDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});
