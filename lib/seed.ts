import type { Database } from "@/lib/types";
import storeDirectory from "@/data/store-directory.json";

type StoreDirectoryEntry = (typeof storeDirectory)[number];

function createStoreDirectoryMarkdown(stores: StoreDirectoryEntry[]): string {
  return [
    "# Kontakty",
    "",
    "Książka adresowa sklepów Bagietka.",
    "",
    "| Kod | Skrót | Nazwa | Miejscowość | Adres | E-mail |",
    "| --- | --- | --- | --- | --- | --- |",
    ...stores.map((store) => `| ${store.code} | ${store.shortcut} | ${store.name} | ${store.city} | ${store.address} | ${store.email} |`)
  ].join("\n");
}

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
        name: "Krzysztof Graczyk",
        email: "krzysztofgraczyk@bagietka.pl",
        role: "ADMIN",
        department: "IT",
        isActive: true,
        passwordHash: "a1d23467081c9be78f2d21b46d6b0342:722284589a896330acf291b4cbc73757a040d39ff8526f24f1ae5c30a732a46620b36334c36ded2d54ec43fed36b957e0704c800ba6c145c6913427390a50c91",
        mustChangePassword: true
      }
    ],
    stores: storeDirectory.map((store) => ({
      id: store.id,
      code: store.code,
      name: store.name,
      city: store.city,
      address: store.address,
      region: "",
      isActive: true
    })),
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
      },
      {
        id: "ka_contacts",
        title: "Kontakty",
        slug: "kontakty",
        body: createStoreDirectoryMarkdown(storeDirectory),
        isPublished: true
      }
    ],
    responseTemplates: [
      {
        id: "tpl_001",
        name: "Hasło tymczasowe",
        body: "Dzień dobry {{user.name}},\n\nTwoje tymczasowe hasło to: [GENERATE]\n\nPo zalogowaniu proszę o zmianę hasła.\n\nPozdrawiam,\n{{assignee.name}}",
        category: "hasło",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "tpl_002",
        name: "Zgłoszenie rozwiązane",
        body: "Dzień dobry {{user.name}},\n\nSprawa {{ticket.number}} została rozwiązana. W razie problemów proszę o dopisanie komentarza.\n\nPozdrawiam,\n{{assignee.name}}",
        category: "ogólne",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "tpl_003",
        name: "Potrzebne informacje",
        body: "Dzień dobry {{user.name}},\n\nProszę o podanie dodatkowych informacji:\n- System operacyjny\n- Numer stanowiska\n- Zdjęcie błędu (jeśli możliwe)\n\nPozdrawiam,\n{{assignee.name}}",
        category: "diagnostyka",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "tpl_004",
        name: "Przekierowanie do dostawcy",
        body: "Wewnętrznie: Przekazano sprawę {{ticket.number}} do dostawcy [VENDOR]. Oczekujemy na odpowiedź.",
        category: "dostawca",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "tpl_005",
        name: "Oczekiwanie na użytkownika",
        body: "Dzień dobry {{user.name}},\n\nProszę o potwierdzenie, czy problem w ticketcie {{ticket.number}} został rozwiązany po ostatnich zmianach.\n\nPozdrawiam,\n{{assignee.name}}",
        category: "oczekiwanie",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "tpl_006",
        name: "Terminał awaria",
        body: "Sprawa {{ticket.number}} wymaga wymiany terminala płatniczego. Skontaktujemy się w celu umówienia serwisu.",
        category: "terminal",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    responseMacros: [
      {
        id: "macro_001",
        name: "Rozwiąż i daj hasło",
        templateId: "tpl_001",
        newStatus: "RESOLVED",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "macro_002",
        name: "Poproś o info",
        templateId: "tpl_003",
        newStatus: "WAITING_FOR_USER",
        isActive: true,
        createdById: "usr_admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    notificationLogs: [],
    adminAuditLogs: [],
    sessions: []
  };
}
