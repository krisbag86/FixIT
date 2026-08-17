import { describe, expect, it } from "vitest";
import {
  getPublicTicketStage,
  isRequesterPortalUser,
  publicTicketStageLabels,
  publicTicketStages
} from "@/lib/requester-portal";
import type { TicketStatus } from "@/lib/types";

describe("requester portal domain", () => {
  it("treats reporter and store manager as requester portal users", () => {
    expect(isRequesterPortalUser({ role: "REPORTER" })).toBe(true);
    expect(isRequesterPortalUser({ role: "STORE_MANAGER" })).toBe(true);
    expect(isRequesterPortalUser({ role: "AGENT" })).toBe(false);
    expect(isRequesterPortalUser({ role: "ADMIN" })).toBe(false);
  });

  it.each([
    ["NEW", "RECEIVED"],
    ["TRIAGED", "RECEIVED"],
    ["IN_PROGRESS", "IN_PROGRESS"],
    ["WAITING_FOR_USER", "WAITING"],
    ["WAITING_FOR_VENDOR", "WAITING"],
    ["RESOLVED", "RESOLVED"],
    ["CLOSED", "CLOSED"],
    ["CANCELLED", "CANCELLED"]
  ] as const)("maps %s to public stage %s", (status, expected) => {
    expect(getPublicTicketStage(status as TicketStatus)).toBe(expected);
  });

  it("keeps every public stage ordered and labelled", () => {
    expect(publicTicketStages).toEqual(["RECEIVED", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED", "CANCELLED"]);
    for (const stage of publicTicketStages) {
      expect(publicTicketStageLabels[stage]).toBeTruthy();
    }
  });
});
