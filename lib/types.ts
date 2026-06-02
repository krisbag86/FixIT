export type UserRole = "REPORTER" | "STORE_MANAGER" | "AGENT" | "ADMIN";

export type TicketStatus =
  | "NEW"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_VENDOR"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type CommentVisibility = "PUBLIC" | "INTERNAL";

export type Store = {
  id: string;
  code: string;
  name: string;
  city: string;
  region: string;
  isActive: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string;
  department?: string;
  isActive: boolean;
};

export type Category = {
  id: string;
  name: string;
  defaultPriority: TicketPriority;
  isActive: boolean;
};

export type Ticket = {
  id: string;
  number: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  blocksWork: boolean;
  contact: string;
  categoryId: string;
  storeId?: string;
  department?: string;
  reporterId: string;
  assigneeId?: string;
  dueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketComment = {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  visibility: CommentVisibility;
  createdAt: string;
};

export type TicketEvent = {
  id: string;
  ticketId: string;
  actorId?: string;
  type: string;
  payload?: Record<string, string>;
  createdAt: string;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  slug: string;
  body: string;
  categoryId?: string;
  isPublished: boolean;
  createdById?: string;
  updatedById?: string;
};

export type NotificationLog = {
  id: string;
  ticketId?: string;
  recipientEmail: string;
  type: string;
  status: "QUEUED" | "SENT" | "FAILED";
  error?: string;
  createdAt: string;
  sentAt?: string;
};

export type Database = {
  meta: {
    ticketSequences: Record<string, number>;
  };
  users: User[];
  stores: Store[];
  categories: Category[];
  tickets: Ticket[];
  comments: TicketComment[];
  events: TicketEvent[];
  knowledgeArticles: KnowledgeArticle[];
  notificationLogs: NotificationLog[];
};
