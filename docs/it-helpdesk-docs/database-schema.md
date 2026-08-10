# Database Schema - PostgreSQL / Prisma

## 1. Glowne encje

- users,
- stores,
- tickets,
- ticket_comments,
- ticket_attachments,
- ticket_events,
- categories,
- knowledge_articles,
- day_log_entries,
- schedule_tasks,
- schedule_duties,
- notification_logs.

## 2. Prisma schema - propozycja startowa

```prisma
enum UserRole {
  REPORTER
  STORE_MANAGER
  AGENT
  ADMIN
}

enum TicketStatus {
  NEW
  TRIAGED
  IN_PROGRESS
  WAITING_FOR_USER
  WAITING_FOR_VENDOR
  RESOLVED
  CLOSED
  CANCELLED
}

enum TicketPriority {
  LOW
  NORMAL
  HIGH
  CRITICAL
}

enum CommentVisibility {
  PUBLIC
  INTERNAL
}

model User {
  id           String   @id @default(cuid())
  name         String?
  email        String   @unique
  role         UserRole @default(REPORTER)
  storeId      String?
  department   String?
  isActive     Boolean  @default(true)
  isScheduleMember Boolean @default(false)
  scheduleOrder Int?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  store             Store?          @relation(fields: [storeId], references: [id])
  reportedTickets   Ticket[]        @relation("TicketReporter")
  assignedTickets   Ticket[]        @relation("TicketAssignee")
  comments          TicketComment[]
  events            TicketEvent[]
  knowledgeArticles KnowledgeArticle[]
  dayLogEntries     DayLogEntry[]
  scheduleTasks     ScheduleTask[] @relation("ScheduleTaskAssignee")
  scheduleDuties    ScheduleDuty[] @relation("ScheduleDutyAssignee")
}

model Store {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  city      String?
  address   String?
  region    String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users   User[]
  tickets Ticket[]
}

model Category {
  id                String          @id @default(cuid())
  name              String
  parentId          String?
  defaultPriority   TicketPriority  @default(NORMAL)
  defaultAssigneeId String?
  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  parent            Category?       @relation("CategoryTree", fields: [parentId], references: [id])
  children          Category[]      @relation("CategoryTree")
  tickets           Ticket[]
  knowledgeArticles KnowledgeArticle[]
}

model Ticket {
  id          String         @id @default(cuid())
  number      String         @unique
  title       String
  description String
  status      TicketStatus   @default(NEW)
  priority    TicketPriority @default(NORMAL)
  impact      String?
  categoryId  String?
  storeId     String?
  reporterId  String
  assigneeId  String?
  dueAt       DateTime?
  resolvedAt  DateTime?
  closedAt    DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  category    Category?          @relation(fields: [categoryId], references: [id])
  store       Store?             @relation(fields: [storeId], references: [id])
  reporter    User               @relation("TicketReporter", fields: [reporterId], references: [id])
  assignee    User?              @relation("TicketAssignee", fields: [assigneeId], references: [id])
  comments    TicketComment[]
  attachments TicketAttachment[]
  events      TicketEvent[]
}

model TicketComment {
  id         String            @id @default(cuid())
  ticketId   String
  authorId   String
  body       String
  visibility CommentVisibility @default(PUBLIC)
  createdAt  DateTime          @default(now())

  ticket      Ticket             @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author      User               @relation(fields: [authorId], references: [id])
  attachments TicketAttachment[]
}

model TicketAttachment {
  id          String   @id @default(cuid())
  ticketId    String
  commentId   String?
  filename    String
  mimeType    String
  size        Int
  storageKey  String
  createdAt   DateTime @default(now())

  ticket  Ticket         @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  comment TicketComment? @relation(fields: [commentId], references: [id], onDelete: SetNull)
}

model TicketEvent {
  id        String   @id @default(cuid())
  ticketId  String
  actorId   String?
  type      String
  payload   Json?
  createdAt DateTime @default(now())

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  actor  User?  @relation(fields: [actorId], references: [id])
}

model KnowledgeArticle {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  body        String
  categoryId  String?
  isPublished Boolean  @default(false)
  createdById String
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  category  Category? @relation(fields: [categoryId], references: [id])
  createdBy User      @relation(fields: [createdById], references: [id])
}

model NotificationLog {
  id             String   @id @default(cuid())
  ticketId       String?
  recipientEmail String
  type           String
  status         String
  error          String?
  createdAt      DateTime @default(now())
}
```

## 6. DayLog

`DayLogEntry` przechowuje wspólne notatki administracyjne ze zgłoszeń telefonicznych
i ustnych. Wpis jest widoczny dla użytkowników z uprawnieniem `ticket:view-all`
(role `AGENT` i `ADMIN`) i zawsze wskazuje autora. Opcjonalne, unikalne `ticketId`
łączy wpis z jednym zgłoszeniem utworzonym na jego podstawie.

```prisma
model DayLogEntry {
  id          String   @id @default(cuid())
  occurredAt  DateTime @default(now())
  fromName    String
  subject     String
  description String
  createdById String
  ticketId    String?  @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy User @relation(fields: [createdById], references: [id])
  ticket Ticket? @relation(fields: [ticketId], references: [id], onDelete: SetNull)

  @@index([occurredAt])
  @@index([createdById])
}
```

Migracje:

- `prisma/migrations/20260804120000_add_daylog/migration.sql` — utworzenie DayLog,
- `prisma/migrations/20260810120000_link_daylog_ticket/migration.sql` — powiązanie wpisu ze zgłoszeniem.

## 7. Grafik tygodniowy

Uczestnicy grafiku nie są wpisani na sztywno. Administrator włącza aktywne konto
`AGENT` lub `ADMIN` polem `User.isScheduleMember` i może ustawić kolejność przez
`User.scheduleOrder`. Historia pozostaje powiązana z identyfikatorem użytkownika.

```prisma
model ScheduleTask {
  id          String   @id @default(cuid())
  date        DateTime @db.Date
  title       String
  description String?
  isCompleted Boolean  @default(false)
  assigneeId  String
  createdById String
  updatedById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ScheduleDuty {
  id          String   @id @default(cuid())
  date        DateTime @db.Date
  assigneeId  String
  createdById String
  createdAt   DateTime @default(now())

  @@unique([date, assigneeId])
}
```

Migracja: `prisma/migrations/20260810160000_add_weekly_schedule/migration.sql`.

## 3. Numeracja ticketow

Format:

```text
IT-YYYY-NNNN
```

Przyklad:

```text
IT-2026-0001
```

Wazne:

- numer powinien byc unikalny,
- generowanie powinno byc odporne na rownolegle requesty,
- w MVP mozna uzyc transakcji i licznika per rok.

## 4. Event log

Kazda wazna akcja powinna tworzyc rekord w `TicketEvent`.

Typy eventow:

- `TICKET_CREATED`,
- `STATUS_CHANGED`,
- `PRIORITY_CHANGED`,
- `ASSIGNEE_CHANGED`,
- `COMMENT_CREATED`,
- `INTERNAL_NOTE_CREATED`,
- `ATTACHMENT_ADDED`,
- `TICKET_RESOLVED`,
- `TICKET_CLOSED`.

## 5. Indeksy do rozwazenia

- `Ticket.status`,
- `Ticket.priority`,
- `Ticket.assigneeId`,
- `Ticket.reporterId`,
- `Ticket.storeId`,
- `Ticket.updatedAt`,
- `Ticket.createdAt`,
- `User.email`,
- `Store.code`,
- `KnowledgeArticle.slug`.
