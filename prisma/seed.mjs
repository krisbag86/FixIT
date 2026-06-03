import { error as logError } from "node:console";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.store.upsert({
    where: { code: "WAW01" },
    update: {
      name: "Bagietka Warszawa Centrum",
      city: "Warszawa",
      region: "Mazowieckie",
      isActive: true
    },
    create: {
      id: "store_waw01",
      code: "WAW01",
      name: "Bagietka Warszawa Centrum",
      city: "Warszawa",
      region: "Mazowieckie",
      isActive: true
    }
  });

  await prisma.store.upsert({
    where: { code: "KRK02" },
    update: {
      name: "Bagietka Krakow Kazimierz",
      city: "Krakow",
      region: "Malopolskie",
      isActive: true
    },
    create: {
      id: "store_krk02",
      code: "KRK02",
      name: "Bagietka Krakow Kazimierz",
      city: "Krakow",
      region: "Malopolskie",
      isActive: true
    }
  });

  // Single admin account — all other users must be added manually via admin panel
  await prisma.user.upsert({
    where: { email: "krzysztofgraczyk@bagietka.pl" },
    update: {
      name: "Krzysztof Graczyk",
      role: "ADMIN",
      department: "IT",
      isActive: true,
      passwordHash: "a1d23467081c9be78f2d21b46d6b0342:722284589a896330acf291b4cbc73757a040d39ff8526f24f1ae5c30a732a46620b36334c36ded2d54ec43fed36b957e0704c800ba6c145c6913427390a50c91",
      mustChangePassword: true
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
    { id: "cat_terminal", name: "Terminal platniczy", defaultPriority: "HIGH", isActive: true },
    { id: "cat_network", name: "Internet / siec", defaultPriority: "HIGH", isActive: true },
    { id: "cat_computer", name: "Komputer / laptop", defaultPriority: "NORMAL", isActive: true },
    { id: "cat_access", name: "Konto / dostep", defaultPriority: "NORMAL", isActive: true },
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
      title: "Szybki restart terminala platniczego",
      body: "Odlacz terminal od zasilania na 20 sekund, wlacz ponownie i sprawdz polaczenie.",
      categoryId: "cat_terminal",
      isPublished: true,
      createdById: "usr_admin"
    },
    create: {
      id: "ka_001",
      title: "Szybki restart terminala platniczego",
      slug: "restart-terminala",
      body: "Odlacz terminal od zasilania na 20 sekund, wlacz ponownie i sprawdz polaczenie.",
      categoryId: "cat_terminal",
      isPublished: true,
      createdById: "usr_admin"
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "raport-dobowy-kasa" },
    update: {
      title: "Jak wydrukowac raport dobowy na kasie",
      body: "Na ekranie glownym kasy wybierz 'Raporty' → 'Raport dobowy'. Kasa wydrukuje podsumowanie sprzedazy. Jesli drukarka nie reaguje, sprawdz czy jest wlaczona i czy ma papier.",
      categoryId: "cat_pos",
      isPublished: true,
      createdById: "usr_admin"
    },
    create: {
      id: "ka_002",
      title: "Jak wydrukowac raport dobowy na kasie",
      slug: "raport-dobowy-kasa",
      body: "Na ekranie glownym kasy wybierz 'Raporty' → 'Raport dobowy'. Kasa wydrukuje podsumowanie sprzedazy. Jesli drukarka nie reaguje, sprawdz czy jest wlaczona i czy ma papier.",
      categoryId: "cat_pos",
      isPublished: true,
      createdById: "usr_admin"
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "reset-hasla-poczta" },
    update: {
      title: "Reset hasla do poczty sluzbowej",
      body: "Skontaktuj sie z IT przez FixIT (nowe zgloszenie → kategoria Poczta). Nowe haslo zostanie wyslane na Twoj numer telefonu w systemie HR.",
      categoryId: "cat_mail",
      isPublished: true,
      createdById: "usr_admin"
    },
    create: {
      id: "ka_003",
      title: "Reset hasla do poczty sluzbowej",
      slug: "reset-hasla-poczta",
      body: "Skontaktuj sie z IT przez FixIT (nowe zgloszenie → kategoria Poczta). Nowe haslo zostanie wyslane na Twoj numer telefonu w systemie HR.",
      categoryId: "cat_mail",
      isPublished: true,
      createdById: "usr_admin"
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "internet-nie-dziala" },
    update: {
      title: "Co zrobic gdy internet nie dziala",
      body: "1. Sprawdz czy switch/swiatla na routerze sa zielone.\n2. Zrestartuj router (odlacz zasilanie na 30 sekund).\n3. Jesli to nie pomaga, utworz zgloszenie w FixIT z kategoria Internet / siec.",
      categoryId: "cat_network",
      isPublished: true,
      createdById: "usr_admin"
    },
    create: {
      id: "ka_004",
      title: "Co zrobic gdy internet nie dziala",
      slug: "internet-nie-dziala",
      body: "1. Sprawdz czy switch/swiatla na routerze sa zielone.\n2. Zrestartuj router (odlacz zasilanie na 30 sekund).\n3. Jesli to nie pomaga, utworz zgloszenie w FixIT z kategoria Internet / siec.",
      categoryId: "cat_network",
      isPublished: true,
      createdById: "usr_admin"
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "zmiana-papieru-drukarka" },
    update: {
      title: "Zmiana papieru w drukarce fiskalnej",
      body: "1. Otworz pokrywe drukarki.\n2. Wloz nowa rolke papieru zgodnie z kierunkiem nadruku na obudowie.\n3. Zamknij pokrywe – drukarka automatycznie przyjmie papier.\n4. Jesli papier sie zacina, otworz ponownie i wyrownaj krawedz.",
      categoryId: "cat_printer",
      isPublished: true,
      createdById: "usr_admin"
    },
    create: {
      id: "ka_005",
      title: "Zmiana papieru w drukarce fiskalnej",
      slug: "zmiana-papieru-drukarka",
      body: "1. Otworz pokrywe drukarki.\n2. Wloz nowa rolke papieru zgodnie z kierunkiem nadruku na obudowie.\n3. Zamknij pokrywe – drukarka automatycznie przyjmie papier.\n4. Jesli papier sie zacina, otworz ponownie i wyrownaj krawedz.",
      categoryId: "cat_printer",
      isPublished: true,
      createdById: "usr_admin"
    }
  });

  await prisma.knowledgeArticle.upsert({
    where: { slug: "zamowienie-sprzetu" },
    update: {
      title: "Jak zamowic nowy sprzet IT",
      body: "Nowy sprzet (komputer, drukarka, terminal) zamawiasz przez zgloszenie w FixIT. Opisz czego potrzebujesz i uzasadnij. Decyzje podejmuje IT w porozumieniu z kierownikiem.",
      categoryId: "cat_computer",
      isPublished: false,
      createdById: "usr_admin"
    },
    create: {
      id: "ka_006",
      title: "Jak zamowic nowy sprzet IT",
      slug: "zamowienie-sprzetu",
      body: "Nowy sprzet (komputer, drukarka, terminal) zamawiasz przez zgloszenie w FixIT. Opisz czego potrzebujesz i uzasadnij. Decyzje podejmuje IT w porozumieniu z kierownikiem.",
      categoryId: "cat_computer",
      isPublished: false,
      createdById: "usr_admin"
    }
  });
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
