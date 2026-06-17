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
  address: string;
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
  passwordHash?: string;
  mustChangePassword?: boolean;
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
  dueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
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

export type TicketAttachment = {
  id: string;
  ticketId: string;
  commentId?: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedById?: string;
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

export type AdminAuditLog = {
  id: string;
  actorId?: string;
  action: string;
  entityType: "USER" | "STORE" | "CATEGORY" | "KNOWLEDGE_ARTICLE";
  entityId: string;
  summary: string;
  payload?: Record<string, string>;
  createdAt: string;
};

export type Session = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type SetupToken = {
  id: string;
  tokenHash: string;
  email: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

export type DashboardMetrics = {
  totalTickets: number;
  openTickets: number;
  criticalTickets: number;
  avgResolutionHours: number | null;
  topCategories: { categoryId: string; categoryName: string; count: number }[];
  slaBreached: {
    ticket: Ticket;
    slaDeadline: string;
    hoursOverdue: number;
  }[];
};

export type DailyTicketCount = {
  date: string;
  created: number;
  resolved: number;
};

export type AgentWorkload = {
  agentId: string;
  agentName: string;
  openCount: number;
};

export type DashboardData = {
  kpi: {
    openTickets: number;
    criticalTickets: number;
    avgResolutionHours: number | null;
    slaBreachedCount: number;
  };
  dailyTicketCounts: DailyTicketCount[];
  topCategories: { categoryId: string; categoryName: string; count: number }[];
  agentWorkload: AgentWorkload[];
  recentEvents: (TicketEvent & { actorName?: string; ticketNumber?: string })[];
};

export type ResponseTemplate = {
  id: string;
  name: string;
  body: string;
  category?: string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ResponseMacro = {
  id: string;
  name: string;
  templateId?: string;
  body?: string;
  newStatus?: TicketStatus;
  newPriority?: TicketPriority;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
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
  attachments: TicketAttachment[];
  events: TicketEvent[];
  knowledgeArticles: KnowledgeArticle[];
  notificationLogs: NotificationLog[];
  adminAuditLogs: AdminAuditLog[];
  sessions: Session[];
  setupTokens: SetupToken[];
  responseTemplates: ResponseTemplate[];
  responseMacros: ResponseMacro[];
};
