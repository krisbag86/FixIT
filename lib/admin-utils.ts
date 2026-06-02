import type { Category, Database, Store, User } from "@/lib/types";

export type AuditChange = {
  field: string;
  from?: string;
  to?: string;
};

function printable(value: string | undefined): string {
  return value && value.length > 0 ? value : "-";
}

export function buildAuditPayload(changes: AuditChange[]): Record<string, string> | undefined {
  if (changes.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    changes.flatMap((change) => [
      [`${change.field}From`, printable(change.from)],
      [`${change.field}To`, printable(change.to)]
    ])
  );
}

export function describeAuditChanges(label: string, name: string, changes: AuditChange[]): string {
  if (changes.length === 0) {
    return `${label} ${name}: bez zmian`;
  }

  const details = changes.map((change) => `${change.field} ${printable(change.from)} -> ${printable(change.to)}`).join(", ");
  return `${label} ${name}: ${details}`;
}

export function getStoreUsageSummary(database: Database, storeId: string): { userCount: number; ticketCount: number } {
  return {
    userCount: database.users.filter((user) => user.storeId === storeId).length,
    ticketCount: database.tickets.filter((ticket) => ticket.storeId === storeId).length
  };
}

export function getCategoryUsageSummary(database: Database, categoryId: string): { ticketCount: number; articleCount: number } {
  return {
    ticketCount: database.tickets.filter((ticket) => ticket.categoryId === categoryId).length,
    articleCount: database.knowledgeArticles.filter((article) => article.categoryId === categoryId).length
  };
}

export function getUserAuditChanges(
  before: User,
  after: Pick<User, "role" | "storeId" | "department" | "isActive">
): AuditChange[] {
  const changes: AuditChange[] = [];

  if (before.role !== after.role) {
    changes.push({ field: "rola", from: before.role, to: after.role });
  }

  if ((before.storeId ?? "") !== (after.storeId ?? "")) {
    changes.push({ field: "sklep", from: before.storeId, to: after.storeId });
  }

  if ((before.department ?? "") !== (after.department ?? "")) {
    changes.push({ field: "dzial", from: before.department, to: after.department });
  }

  if (before.isActive !== after.isActive) {
    changes.push({
      field: "aktywny",
      from: before.isActive ? "tak" : "nie",
      to: after.isActive ? "tak" : "nie"
    });
  }

  return changes;
}

export function getStoreAuditChanges(
  before: Store,
  after: Pick<Store, "code" | "name" | "city" | "region" | "isActive">
): AuditChange[] {
  const changes: AuditChange[] = [];

  if (before.code !== after.code) {
    changes.push({ field: "kod", from: before.code, to: after.code });
  }

  if (before.name !== after.name) {
    changes.push({ field: "nazwa", from: before.name, to: after.name });
  }

  if (before.city !== after.city) {
    changes.push({ field: "miasto", from: before.city, to: after.city });
  }

  if (before.region !== after.region) {
    changes.push({ field: "region", from: before.region, to: after.region });
  }

  if (before.isActive !== after.isActive) {
    changes.push({
      field: "aktywny",
      from: before.isActive ? "tak" : "nie",
      to: after.isActive ? "tak" : "nie"
    });
  }

  return changes;
}

export function getCategoryAuditChanges(
  before: Category,
  after: Pick<Category, "name" | "defaultPriority" | "isActive">
): AuditChange[] {
  const changes: AuditChange[] = [];

  if (before.name !== after.name) {
    changes.push({ field: "nazwa", from: before.name, to: after.name });
  }

  if (before.defaultPriority !== after.defaultPriority) {
    changes.push({ field: "priorytet", from: before.defaultPriority, to: after.defaultPriority });
  }

  if (before.isActive !== after.isActive) {
    changes.push({
      field: "aktywny",
      from: before.isActive ? "tak" : "nie",
      to: after.isActive ? "tak" : "nie"
    });
  }

  return changes;
}
