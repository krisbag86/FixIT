import type { CommentVisibility, TicketPriority, TicketStatus, UserRole } from "@/lib/types";

export const roleLabels: Record<UserRole, string> = {
  REPORTER: "Zglaszajacy",
  STORE_MANAGER: "Kierownik sklepu",
  AGENT: "IT Agent",
  ADMIN: "Admin"
};

export const statusLabels: Record<TicketStatus, string> = {
  NEW: "Nowe",
  TRIAGED: "Zweryfikowane",
  IN_PROGRESS: "W trakcie",
  WAITING_FOR_USER: "Czeka na uzytkownika",
  WAITING_FOR_VENDOR: "Czeka na dostawce",
  RESOLVED: "Rozwiazane",
  CLOSED: "Zamkniete",
  CANCELLED: "Anulowane"
};

export const priorityLabels: Record<TicketPriority, string> = {
  LOW: "Niski",
  NORMAL: "Normalny",
  HIGH: "Wysoki",
  CRITICAL: "Krytyczny"
};

export const visibilityLabels: Record<CommentVisibility, string> = {
  PUBLIC: "Publiczny",
  INTERNAL: "Wewnetrzny"
};

export const ticketStatuses = Object.keys(statusLabels) as TicketStatus[];
export const ticketPriorities = Object.keys(priorityLabels) as TicketPriority[];
