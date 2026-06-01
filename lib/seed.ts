import type { Database } from "@/lib/types";

const now = new Date("2026-06-01T10:00:00.000Z").toISOString();

export function createSeedDatabase(): Database {
  return {
    meta: {
      ticketSequences: {
        "2026": 3
      }
    },
    users: [
      {
        id: "usr_admin",
        name: "Alicja Admin",
        email: "admin@bagietka.pl",
        role: "ADMIN",
        department: "IT",
        isActive: true
      },
      {
        id: "usr_agent",
        name: "Marek Agent",
        email: "agent@bagietka.pl",
        role: "AGENT",
        department: "IT",
        isActive: true
      },
      {
        id: "usr_manager",
        name: "Kasia Kierownik",
        email: "sklep.waw01@bagietka.pl",
        role: "STORE_MANAGER",
        storeId: "store_waw01",
        isActive: true
      },
      {
        id: "usr_reporter",
        name: "Jan Kasjer",
        email: "kasjer@bagietka.pl",
        role: "REPORTER",
        storeId: "store_waw01",
        isActive: true
      }
    ],
    stores: [
      {
        id: "store_waw01",
        code: "WAW01",
        name: "Bagietka Warszawa Centrum",
        city: "Warszawa",
        region: "Mazowieckie",
        isActive: true
      },
      {
        id: "store_krk02",
        code: "KRK02",
        name: "Bagietka Krakow Kazimierz",
        city: "Krakow",
        region: "Malopolskie",
        isActive: true
      }
    ],
    categories: [
      { id: "cat_pos", name: "Kasa / POS", defaultPriority: "CRITICAL", isActive: true },
      { id: "cat_printer", name: "Drukarka fiskalna", defaultPriority: "HIGH", isActive: true },
      { id: "cat_terminal", name: "Terminal platniczy", defaultPriority: "HIGH", isActive: true },
      { id: "cat_network", name: "Internet / siec", defaultPriority: "HIGH", isActive: true },
      { id: "cat_computer", name: "Komputer / laptop", defaultPriority: "NORMAL", isActive: true },
      { id: "cat_access", name: "Konto / dostep", defaultPriority: "NORMAL", isActive: true },
      { id: "cat_mail", name: "Poczta", defaultPriority: "NORMAL", isActive: true },
      { id: "cat_other", name: "Inne", defaultPriority: "NORMAL", isActive: true }
    ],
    tickets: [
      {
        id: "t_001",
        number: "IT-2026-0001",
        title: "Terminal nie laczy sie z siecia",
        description: "Terminal platniczy przy kasie 2 od rana pokazuje brak polaczenia.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        blocksWork: true,
        contact: "+48 500 100 200",
        categoryId: "cat_terminal",
        storeId: "store_waw01",
        reporterId: "usr_reporter",
        assigneeId: "usr_agent",
        createdAt: "2026-06-01T08:12:00.000Z",
        updatedAt: "2026-06-01T09:05:00.000Z"
      },
      {
        id: "t_002",
        number: "IT-2026-0002",
        title: "Nowy dostep do systemu magazynowego",
        description: "Prosze o nadanie dostepu dla nowej osoby w biurze.",
        status: "NEW",
        priority: "NORMAL",
        blocksWork: false,
        contact: "biuro@bagietka.pl",
        categoryId: "cat_access",
        department: "Biuro",
        reporterId: "usr_manager",
        createdAt: "2026-06-01T09:30:00.000Z",
        updatedAt: "2026-06-01T09:30:00.000Z"
      }
    ],
    comments: [
      {
        id: "c_001",
        ticketId: "t_001",
        authorId: "usr_agent",
        body: "Sprawdzamy polaczenie operatora i konfiguracje terminala.",
        visibility: "PUBLIC",
        createdAt: "2026-06-01T09:05:00.000Z"
      },
      {
        id: "c_002",
        ticketId: "t_001",
        authorId: "usr_agent",
        body: "Jesli restart terminala nie pomoze, eskalowac do dostawcy.",
        visibility: "INTERNAL",
        createdAt: "2026-06-01T09:06:00.000Z"
      }
    ],
    events: [
      {
        id: "e_001",
        ticketId: "t_001",
        actorId: "usr_reporter",
        type: "TICKET_CREATED",
        createdAt: "2026-06-01T08:12:00.000Z"
      },
      {
        id: "e_002",
        ticketId: "t_001",
        actorId: "usr_agent",
        type: "ASSIGNEE_CHANGED",
        payload: { assigneeId: "usr_agent" },
        createdAt: "2026-06-01T09:00:00.000Z"
      }
    ],
    knowledgeArticles: [
      {
        id: "ka_001",
        title: "Szybki restart terminala platniczego",
        slug: "restart-terminala",
        body: "Odlacz terminal od zasilania na 20 sekund, wlacz ponownie i sprawdz polaczenie.",
        categoryId: "cat_terminal",
        isPublished: true
      }
    ],
    notificationLogs: [
      {
        id: "n_001",
        ticketId: "t_001",
        recipientEmail: "kasjer@bagietka.pl",
        type: "TICKET_CREATED",
        status: "QUEUED",
        createdAt: now
      }
    ]
  };
}
