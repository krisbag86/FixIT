import { error as logError } from "node:console";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

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

  // Single admin account — all other users must be added manually via admin panel
  const admin = await prisma.user.upsert({
    where: { email: "krzysztofgraczyk@bagietka.pl" },
    update: {
      name: "Krzysztof Graczyk",
      role: "ADMIN",
      department: "IT",
      isActive: true,
      mustChangePassword: false
    },
    create: {
      id: "usr_admin",
      name: "Krzysztof Graczyk",
      email: "krzysztofgraczyk@bagietka.pl",
      role: "ADMIN",
      department: "IT",
      isActive: true,
      passwordHash: "a1d23467081c9be78f2d21b46d6b0342:722284589a896330acf291b4cbc73757a040d39ff8526f24f1ae5c30a732a46620b36334c36ded2d54ec43fed36b957e0704c800ba6c145c6913427390a50c91",
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
    update: { sequence: 0 },
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
