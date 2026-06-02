import type { Database } from "@/lib/types";

const now = new Date("2026-06-01T10:00:00.000Z").toISOString();

export function createSeedDatabase(): Database {
  return {
    meta: {
      ticketSequences: {
        "2026": 0
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
        name: "Bagietka Kraków Kazimierz",
        city: "Kraków",
        region: "Małopolskie",
        isActive: true
      }
    ],
    categories: [
      { id: "cat_pos", name: "Kasa / POS", defaultPriority: "CRITICAL", isActive: true },
      { id: "cat_printer", name: "Drukarka fiskalna", defaultPriority: "HIGH", isActive: true },
      { id: "cat_terminal", name: "Terminal płatniczy", defaultPriority: "HIGH", isActive: true },
      { id: "cat_network", name: "Internet / sieć", defaultPriority: "HIGH", isActive: true },
      { id: "cat_computer", name: "Komputer / laptop", defaultPriority: "NORMAL", isActive: true },
      { id: "cat_access", name: "Konto / dostęp", defaultPriority: "NORMAL", isActive: true },
      { id: "cat_mail", name: "Poczta", defaultPriority: "NORMAL", isActive: true },
      { id: "cat_other", name: "Inne", defaultPriority: "NORMAL", isActive: true }
    ],
    tickets: [],
    comments: [],
    attachments: [],
    events: [],
    knowledgeArticles: [
      {
        id: "ka_001",
        title: "Szybki restart terminala płatniczego",
        slug: "restart-terminala",
        body: "Odłącz terminal od zasilania na 20 sekund, włącz ponownie i sprawdź połączenie.",
        categoryId: "cat_terminal",
        isPublished: true
      },
      {
        id: "ka_002",
        title: "Jak wydrukować raport dobowy na kasie",
        slug: "raport-dobowy-kasa",
        body: "Na ekranie głównym kasy wybierz 'Raporty' → 'Raport dobowy'. Kasa wydrukuje podsumowanie sprzedaży. Jeśli drukarka nie reaguje, sprawdź czy jest włączona i czy ma papier.",
        categoryId: "cat_pos",
        isPublished: true
      },
      {
        id: "ka_003",
        title: "Reset hasła do poczty służbowej",
        slug: "reset-hasla-poczta",
        body: "Skontaktuj się z IT przez FixIT (nowe zgłoszenie → kategoria Poczta). Nowe hasło zostanie wysłane na Twój numer telefonu w systemie HR.",
        categoryId: "cat_mail",
        isPublished: true
      },
      {
        id: "ka_004",
        title: "Co zrobić gdy internet nie działa",
        slug: "internet-nie-dziala",
        body: "1. Sprawdź czy switch/światła na routerze są zielone.\n2. Zrestartuj router (odłącz zasilanie na 30 sekund).\n3. Jeśli to nie pomaga, utwórz zgłoszenie w FixIT z kategorią Internet / sieć.",
        categoryId: "cat_network",
        isPublished: true
      },
      {
        id: "ka_005",
        title: "Zmiana papieru w drukarce fiskalnej",
        slug: "zmiana-papieru-drukarka",
        body: "1. Otwórz pokrywę drukarki.\n2. Włóż nową rolkę papieru zgodnie z kierunkiem nadruku na obudowie.\n3. Zamknij pokrywę – drukarka automatycznie przyjmie papier.\n4. Jeśli papier się zacina, otwórz ponownie i wyrównaj krawędź.",
        categoryId: "cat_printer",
        isPublished: true
      },
      {
        id: "ka_006",
        title: "Jak zamówić nowy sprzęt IT",
        slug: "zamowienie-sprzetu",
        body: "Nowy sprzęt (komputer, drukarka, terminal) zamawiasz przez zgłoszenie w FixIT. Opisz czego potrzebujesz i uzasadnij. Decyzję podejmuje IT w porozumieniu z kierownikiem.",
        categoryId: "cat_computer",
        isPublished: false
      }
    ],
    notificationLogs: [],
    adminAuditLogs: []
  };
}
