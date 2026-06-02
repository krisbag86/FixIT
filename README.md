# 🔧 FixIT — System Zgłoszeń IT

Wewnętrzny system helpdesk IT dla sklepów i biura **Bagietka**. Nowoczesna aplikacja webowa do zarządzania zgłoszeniami IT, zbudowana na Next.js 15 z Prisma ORM i PostgreSQL.

---

## ✨ Funkcjonalności

- **Zgłoszenia** — Tworzenie, przeglądanie i zarządzanie zgłoszeniami IT
- **Panel IT** — Dashboard z metrykami, wykresami i SLA
- **Kanban** — Wizualne zarządzanie zgłoszeniami metodą przeciągnij i upuść
- **Baza wiedzy** — Artykuły FAQ dla użytkowników
- **Autoryzacja** — Logowanie przez e-mail w domenie `bagietka.pl`
- **Tryb ciemny** — Wsparcie dla jasnego i ciemnego motywu
- **Załączniki** — Przesyłanie plików przez S3 (Railway Bucket)
- **Powiadomienia e-mail** — Automatyczne powiadomienia o zmianach statusu

---

## 🚀 Uruchomienie lokalne

### Wymagania

- **Node.js** 20+
- **Docker** (opcjonalnie, dla PostgreSQL)
- **npm**

### Szybki start przez Dockera (rekomendowany)

```bash
# Uruchom całe środowisko (aplikacja + PostgreSQL)
docker compose up

# Aplikacja będzie dostępna pod adresem:
# http://localhost:3001
```

Compose uruchamia Next.js na porcie `3001` (mapowanym na `3000` w kontenerze) oraz PostgreSQL na porcie `5433`.

### Uruchomienie bez Dockera

```bash
# Zainstaluj zależności
npm install

# Wygeneruj klienta Prisma
npm run db:generate

# Uruchom w trybie deweloperskim
npm run dev
```

> **Uwaga:** Bez PostgreSQL aplikacja używa lokalnego pliku JSON jako magazynu danych (`.data/fixit-db.json`). Aby używać Prisma, ustaw zmienną `DATABASE_URL`.

---

## 🌐 Wdrożenie na Railway

Projekt jest skonfigurowany do automatycznego wdrożenia na **[Railway](https://railway.com)** przez GitHub.

### Pierwsze wdrożenie

1. **Forknij / sklonuj** repozytorium na GitHub
2. Na Railway: **Nowy projekt → Deploy z repozytorium GitHub**
3. Railway automatycznie wykryje `Dockerfile` i zbuduje aplikację
4. Dodaj **PostgreSQL** jako usługę zależną
5. Ustaw wymagane zmienne środowiskowe (patrz niżej)

### Zmienne środowiskowe

| Zmienna | Opis | Przykład |
|---|---|---|
| `DATABASE_URL` | URL połączenia z PostgreSQL | `postgresql://...` |
| `NEXTAUTH_SECRET` | Sekret do podpisywania sesji | `twoj-tajny-klucz` |
| `NEXTAUTH_URL` | Publiczny URL aplikacji | `https://twoja-aplikacja.up.railway.app` |
| `EMAIL_FROM` | Adres nadawcy e-mail | `FixIT <it@bagietka.pl>` |
| `SMTP_HOST` | Host serwera SMTP | |
| `SMTP_PORT` | Port SMTP | `465` |
| `SMTP_USER` | Użytkownik SMTP | |
| `SMTP_PASSWORD` | Hasło SMTP | |
| `S3_ENDPOINT` | Endpoint S3 (Railway Bucket) | |
| `S3_ACCESS_KEY_ID` | Klucz dostępu S3 | |
| `S3_SECRET_ACCESS_KEY` | Sekretny klucz S3 | |
| `S3_BUCKET` | Nazwa bucketa S3 | |
| `PORT` | Port aplikacji | `8080` |

### Wdrożenie z CLI

```bash
# Zainstaluj Railway CLI
bash <(curl -fsSL https://railway.com/install.sh)

# Zaloguj się
railway login

# Połącz z projektem
railway link --project nazwa-projektu

# Wdróż
railway up --detach --service FixIT
```

---

## 🧪 Walidacja

```bash
# Sprawdź typy
npm run typecheck

# Uruchom testy jednostkowe
npm run test

# Uruchom linter
npm run lint

# Testy E2E (wymaga Playwright)
npm run test:e2e
```

---

## 📁 Struktura projektu

```
├── app/                  # Next.js App Router
│   ├── admin/            # Panel administracyjny
│   ├── api/              # API routes
│   ├── login/            # Strona logowania
│   ├── tickets/          # Zarządzanie zgłoszeniami
│   ├── knowledge/        # Baza wiedzy
│   └── globals.css       # Globalne style
├── components/           # Komponenty UI
│   ├── admin/            # Komponenty panelu IT
│   ├── knowledge/        # Komponenty bazy wiedzy
│   ├── tickets/          # Komponenty zgłoszeń
│   └── ui/               # Uniwersalne komponenty UI
├── lib/                  # Logika biznesowa
│   ├── prisma.ts         # Klient Prisma
│   ├── data-store.ts     # Warstwa dostępu do danych
│   ├── auth.ts           # Autoryzacja i sesje
│   ├── permissions.ts    # System uprawnień
│   └── email.ts          # Wysyłanie e-maili
├── prisma/               # Schemat i migracje bazy danych
├── tests/                # Testy
├── Dockerfile            # Obraz produkcyjny
└── docker-compose.yml    # Środowisko deweloperskie
```

---

## 🛠️ Technologie

| Technologia | Zastosowanie |
|---|---|
| **Next.js 15** | Framework aplikacji |
| **React 19** | Interfejs użytkownika |
| **Prisma** | ORM i migracje bazy danych |
| **PostgreSQL** | Baza danych |
| **Tailwind CSS** | Stylowanie |
| **TypeScript** | Typowanie |
| **Railway** | Hosting i infrastruktura |
| **AWS SDK S3** | Przechowywanie załączników |
| **Nodemailer** | Wysyłanie e-maili |
| **Playwright** | Testy E2E |
| **Vitest** | Testy jednostkowe |

---

## 📄 Licencja

Projekt wewnętrzny — **Bagietka Sp. z o.o.**


