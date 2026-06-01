import type { Ticket, User } from "@/lib/types";

export type PermissionAction =
  | "ticket:create"
  | "ticket:view"
  | "ticket:view-store"
  | "ticket:view-all"
  | "ticket:update"
  | "comment:public"
  | "comment:internal"
  | "admin:manage-users"
  | "admin:manage-stores"
  | "admin:manage-categories"
  | "admin:manage-faq";

const agentRoles = new Set(["AGENT", "ADMIN"]);

export function isAgent(user: Pick<User, "role">): boolean {
  return agentRoles.has(user.role);
}

export function can(user: User, action: PermissionAction): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "AGENT") {
    return [
      "ticket:create",
      "ticket:view",
      "ticket:view-store",
      "ticket:view-all",
      "ticket:update",
      "comment:public",
      "comment:internal"
    ].includes(action);
  }

  if (user.role === "STORE_MANAGER") {
    return ["ticket:create", "ticket:view", "ticket:view-store", "comment:public"].includes(action);
  }

  return ["ticket:create", "ticket:view", "comment:public"].includes(action);
}

export function canViewTicket(user: User, ticket: Ticket): boolean {
  if (can(user, "ticket:view-all")) {
    return true;
  }

  if (ticket.reporterId === user.id) {
    return true;
  }

  return can(user, "ticket:view-store") && Boolean(user.storeId) && user.storeId === ticket.storeId;
}

export function canUseAdmin(user: User): boolean {
  return can(user, "ticket:view-all");
}
