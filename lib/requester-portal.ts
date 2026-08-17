import type { TicketStatus, User } from "@/lib/types";

export type PublicTicketStage = "RECEIVED" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED" | "CANCELLED";

export const publicTicketStages: PublicTicketStage[] = ["RECEIVED", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED", "CANCELLED"];

export const publicTicketStageLabels: Record<PublicTicketStage, string> = {
  RECEIVED: "Przyjęte",
  IN_PROGRESS: "W trakcie",
  WAITING: "Oczekuje",
  RESOLVED: "Rozwiązane",
  CLOSED: "Zamknięte",
  CANCELLED: "Anulowane"
};

export function isRequesterPortalUser(user: Pick<User, "role">): boolean {
  return user.role === "REPORTER" || user.role === "STORE_MANAGER";
}

export function getPublicTicketStage(status: TicketStatus): PublicTicketStage {
  if (status === "NEW" || status === "TRIAGED") return "RECEIVED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "WAITING_FOR_USER" || status === "WAITING_FOR_VENDOR") return "WAITING";
  if (status === "RESOLVED") return "RESOLVED";
  if (status === "CLOSED") return "CLOSED";
  return "CANCELLED";
}
