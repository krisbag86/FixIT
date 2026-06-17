import { error as logError } from "node:console";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DEV_ADMIN_EMAIL = "krzysztofgraczyk@bagietka.pl";
const DEFAULT_DEV_ADMIN_PASSWORD = "admin1234";
const DEFAULT_ADMIN_NAME = "Krzysztof Graczyk";
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";
const PASSWORD_SALT_LENGTH = 16;

function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

function getBootstrapAdminConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const email = (process.env.FIXIT_BOOTSTRAP_ADMIN_EMAIL || (!isProduction ? DEFAULT_DEV_ADMIN_EMAIL : "")).trim().toLowerCase();
  const password = process.env.FIXIT_BOOTSTRAP_ADMIN_PASSWORD || (!isProduction ? DEFAULT_DEV_ADMIN_PASSWORD : "");
  const name = process.env.FIXIT_BOOTSTRAP_ADMIN_NAME || DEFAULT_ADMIN_NAME;

  if (!email || !password) {
    throw new Error(
      "Production seed requires FIXIT_BOOTSTRAP_ADMIN_EMAIL and FIXIT_BOOTSTRAP_ADMIN_PASSWORD. " +
        "Do not seed a production database with default credentials."
    );
  }

  return { email, password, name };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(rootDir, relativePath), "utf8"));
}

function createStoreDirectoryMarkdown(stores) {
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

async function upsertContactsArticle(storeDirectory, adminId) {
  const body = createStoreDirectoryMarkdown(storeDirectory);
  const contactsArticle = await prisma.knowledgeArticle.findUnique({ where: { slug: "kontakty" } });
  const legacyArticle = await prisma.knowledgeArticle.findUnique({ where: { slug: "ksiazka-adresowa" } });

  if (contactsArticle) {
    await prisma.knowledgeArticle.update({
      where: { id: contactsArticle.id },
      data: {
        title: "Kontakty",
        body,
        isPublished: true,
        createdById: adminId,
        updatedById: adminId
      }
    });

    if (legacyArticle && legacyArticle.id !== contactsArticle.id) {
      await prisma.knowledgeArticle.update({
        where: { id: legacyArticle.id },
        data: {
          title: "Książka adresowa sklepów (archiwum)",
          isPublished: false,
          updatedById: adminId
        }
      });
    }

    return;
  }

  if (legacyArticle) {
    await prisma.knowledgeArticle.update({
      where: { id: legacyArticle.id },
      data: {
        title: "Kontakty",
        slug: "kontakty",
        body,
        isPublished: true,
        createdById: adminId,
        updatedById: adminId
      }
    });
    return;
  }

  await prisma.knowledgeArticle.create({
    data: {
      id: "ka_contacts",
      title: "Kontakty",
      slug: "kontakty",
      body,
      isPublished: true,
      createdById: adminId
    }
  });
}

async function main() {
  const storeDirectory = await readJson("data/store-directory.json");

  await prisma.store.updateMany({
    where: { code: { in: ["WAW01", "KRK02"] } },
    data: { isActive: false }
  });

  for (const store of storeDirectory) {
    await prisma.store.upsert({
      where: { code: store.code },
      update: {
        name: store.name,
        city: store.city,
        address: store.address,
        region: "",
        isActive: true
      },
      create: {
        id: store.id,
        code: store.code,
        name: store.name,
        city: store.city,
        address: store.address,
        region: "",
        isActive: true
      }
    });
  }

  // Bootstrap admin account. Production must provide explicit credentials via env.
  const bootstrapAdmin = getBootstrapAdminConfig();
  const admin = await prisma.user.upsert({
    where: { email: bootstrapAdmin.email },
    update: {
      name: bootstrapAdmin.name,
      role: "ADMIN",
      department: "IT",
      isActive: true
    },
    create: {
      id: "usr_admin",
      name: bootstrapAdmin.name,
      email: bootstrapAdmin.email,
      role: "ADMIN",
      department: "IT",
      isActive: true,
      passwordHash: hashPassword(bootstrapAdmin.password),
      mustChangePassword: true
    }
  });

  const categories = [
    { id: "cat_pos", name: "Kasa / POS", defaultPriority: "CRITICAL", isActive: true },
    { id: "cat_printer", name: "Drukarka fiskalna", defaultPriority: "HIGH", isActive: true },
    { id: "cat_terminal", name: "Terminal płatniczy", defaultPriority: "HIGH", isActive: true },
    { id: "cat_network", name: "Internet / sieć", defaultPriority: "HIGH", isActive: true },
    { id: "cat_computer", name: "Komputer / laptop", defaultPriority: "NORMAL", isActive: true },
    { id: "cat_access", name: "Konto / dostęp", defaultPriority: "NORMAL", isActive: true },
    { id: "cat_mail", name: "Poczta", defaultPriority: "NORMAL", isActive: true },
    { id: "cat_other", name: "Inne", defaultPriority: "NORMAL", isActive: true }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category
    });
  }

  await prisma.ticketCounter.upsert({
    where: { year: 2026 },
    update: {},
    create: { year: 2026, sequence: 0 }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "restart-terminala" },
    update: {
      title: "Szybki restart terminala płatniczego",
      body: "Odłącz terminal od zasilania na 20 sekund, włącz ponownie i sprawdź połączenie.",
      categoryId: "cat_terminal",
      isPublished: true,
      createdById: admin.id
    },
    create: {
      id: "ka_001",
      title: "Szybki restart terminala płatniczego",
      slug: "restart-terminala",
      body: "Odłącz terminal od zasilania na 20 sekund, włącz ponownie i sprawdź połączenie.",
      categoryId: "cat_terminal",
      isPublished: true,
      createdById: admin.id
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "raport-dobowy-kasa" },
    update: {
      title: "Jak wydrukować raport dobowy na kasie",
      body: "Na ekranie głównym kasy wybierz 'Raporty' → 'Raport dobowy'. Kasa wydrukuje podsumowanie sprzedaży. Jeśli drukarka nie reaguje, sprawdź czy jest włączona i czy ma papier.",
      categoryId: "cat_pos",
      isPublished: true,
      createdById: admin.id
    },
    create: {
      id: "ka_002",
      title: "Jak wydrukować raport dobowy na kasie",
      slug: "raport-dobowy-kasa",
      body: "Na ekranie głównym kasy wybierz 'Raporty' → 'Raport dobowy'. Kasa wydrukuje podsumowanie sprzedaży. Jeśli drukarka nie reaguje, sprawdź czy jest włączona i czy ma papier.",
      categoryId: "cat_pos",
      isPublished: true,
      createdById: admin.id
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "reset-hasla-poczta" },
    update: {
      title: "Reset hasła do poczty służbowej",
      body: "Skontaktuj się z IT przez FixIT (nowe zgłoszenie → kategoria Poczta). Nowe hasło zostanie wysłane na Twój numer telefonu w systemie HR.",
      categoryId: "cat_mail",
      isPublished: true,
      createdById: admin.id
    },
    create: {
      id: "ka_003",
      title: "Reset hasła do poczty służbowej",
      slug: "reset-hasla-poczta",
      body: "Skontaktuj się z IT przez FixIT (nowe zgłoszenie → kategoria Poczta). Nowe hasło zostanie wysłane na Twój numer telefonu w systemie HR.",
      categoryId: "cat_mail",
      isPublished: true,
      createdById: admin.id
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "internet-nie-dziala" },
    update: {
      title: "Co zrobić gdy internet nie działa",
      body: "1. Sprawdź czy switch/światła na routerze są zielone.\n2. Zrestartuj router (odłącz zasilanie na 30 sekund).\n3. Jeśli to nie pomaga, utwórz zgłoszenie w FixIT z kategorią Internet / sieć.",
      categoryId: "cat_network",
      isPublished: true,
      createdById: admin.id
    },
    create: {
      id: "ka_004",
      title: "Co zrobić gdy internet nie działa",
      slug: "internet-nie-dziala",
      body: "1. Sprawdź czy switch/światła na routerze są zielone.\n2. Zrestartuj router (odłącz zasilanie na 30 sekund).\n3. Jeśli to nie pomaga, utwórz zgłoszenie w FixIT z kategorią Internet / sieć.",
      categoryId: "cat_network",
      isPublished: true,
      createdById: admin.id
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "zmiana-papieru-drukarka" },
    update: {
      title: "Zmiana papieru w drukarce fiskalnej",
      body: "1. Otwórz pokrywę drukarki.\n2. Włóż nową rolkę papieru zgodnie z kierunkiem nadruku na obudowie.\n3. Zamknij pokrywę - drukarka automatycznie przyjmie papier.\n4. Jeśli papier się zacina, otwórz ponownie i wyrównaj krawędź.",
      categoryId: "cat_printer",
      isPublished: true,
      createdById: admin.id
    },
    create: {
      id: "ka_005",
      title: "Zmiana papieru w drukarce fiskalnej",
      slug: "zmiana-papieru-drukarka",
      body: "1. Otwórz pokrywę drukarki.\n2. Włóż nową rolkę papieru zgodnie z kierunkiem nadruku na obudowie.\n3. Zamknij pokrywę - drukarka automatycznie przyjmie papier.\n4. Jeśli papier się zacina, otwórz ponownie i wyrównaj krawędź.",
      categoryId: "cat_printer",
      isPublished: true,
      createdById: admin.id
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "zamowienie-sprzetu" },
    update: {
      title: "Jak zamówić nowy sprzęt IT",
      body: "Nowy sprzęt (komputer, drukarka, terminal) zamawiasz przez zgłoszenie w FixIT. Opisz czego potrzebujesz i uzasadnij. Decyzję podejmuje IT w porozumieniu z kierownikiem.",
      categoryId: "cat_computer",
      isPublished: false,
      createdById: admin.id
    },
    create: {
      id: "ka_006",
      title: "Jak zamówić nowy sprzęt IT",
      slug: "zamowienie-sprzetu",
      body: "Nowy sprzęt (komputer, drukarka, terminal) zamawiasz przez zgłoszenie w FixIT. Opisz czego potrzebujesz i uzasadnij. Decyzję podejmuje IT w porozumieniu z kierownikiem.",
      categoryId: "cat_computer",
      isPublished: false,
      createdById: admin.id
    }
  });

  await upsertContactsArticle(storeDirectory, admin.id);

  // Seed response templates
  const templates = [
    {
      id: "tpl_001",
      name: "Hasło tymczasowe",
      body: "Dzień dobry {{user.name}},\n\nTwoje tymczasowe hasło to: [GENERATE]\n\nPo zalogowaniu proszę o zmianę hasła.\n\nPozdrawiam,\n{{assignee.name}}",
      category: "hasło"
    },
    {
      id: "tpl_002",
      name: "Zgłoszenie rozwiązane",
      body: "Dzień dobry {{user.name}},\n\nSprawa {{ticket.number}} została rozwiązana. W razie problemów proszę o dopisanie komentarza.\n\nPozdrawiam,\n{{assignee.name}}",
      category: "ogólne"
    },
    {
      id: "tpl_003",
      name: "Potrzebne informacje",
      body: "Dzień dobry {{user.name}},\n\nProszę o podanie dodatkowych informacji:\n- System operacyjny\n- Numer stanowiska\n- Zdjęcie błędu (jeśli możliwe)\n\nPozdrawiam,\n{{assignee.name}}",
      category: "diagnostyka"
    },
    {
      id: "tpl_004",
      name: "Przekierowanie do dostawcy",
      body: "Wewnętrznie: Przekazano sprawę {{ticket.number}} do dostawcy [VENDOR]. Oczekujemy na odpowiedź.",
      category: "dostawca"
    },
    {
      id: "tpl_005",
      name: "Oczekiwanie na użytkownika",
      body: "Dzień dobry {{user.name}},\n\nProszę o potwierdzenie, czy problem w ticketcie {{ticket.number}} został rozwiązany po ostatnich zmianach.\n\nPozdrawiam,\n{{assignee.name}}",
      category: "oczekiwanie"
    },
    {
      id: "tpl_006",
      name: "Terminał awaria",
      body: "Sprawa {{ticket.number}} wymaga wymiany terminala płatniczego. Skontaktujemy się w celu umówienia serwisu.",
      category: "terminal"
    }
  ];

  for (const tpl of templates) {
    await prisma.responseTemplate.upsert({
      where: { id: tpl.id },
      update: {
        name: tpl.name,
        body: tpl.body,
        category: tpl.category
      },
      create: {
        ...tpl,
        createdById: admin.id
      }
    });
  }

  // Seed response macros
  const macros = [
    {
      id: "macro_001",
      name: "Rozwiąż i daj hasło",
      templateId: "tpl_001",
      newStatus: "RESOLVED"
    },
    {
      id: "macro_002",
      name: "Poproś o info",
      templateId: "tpl_003",
      newStatus: "WAITING_FOR_USER"
    }
  ];

  for (const macro of macros) {
    await prisma.responseMacro.upsert({
      where: { id: macro.id },
      update: {
        name: macro.name,
        templateId: macro.templateId,
        newStatus: macro.newStatus
      },
      create: {
        ...macro,
        createdById: admin.id
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logError(error);
    await prisma.$disconnect();
    process.exit(1);
  });
