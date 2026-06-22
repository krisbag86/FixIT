# 🔧 FixIT — System Zgłoszeń IT

Wewnętrzny system helpdesk IT dla sklepów i biura **Bagietka**. Nowoczesna aplikacja webowa do zarządzania zgłoszeniami IT, zbudowana na Next.js 15 z Prisma ORM i PostgreSQL.

---

## ✨ Funkcjonalności

- **Zgłoszenia** — Tworzenie, przeglądanie i zarządzanie zgłoszeniami IT
- **Panel IT** — Dashboard z metrykami, wykresami i SLA
- **Kanban** — Wizualne zarządzanie zgłoszeniami metodą przeciągnij i upuść
- **Baza wiedzy** — Artykuły FAQ dla użytkowników
- **Autoryzacja** — Logowanie i rejestracja tylko dla adresów w domenie `bagietka.pl`
- **Administracja użytkownikami** — Admin może tworzyć, usuwać i dezaktywować konta, nadawać role oraz wysyłać lub regenerować link aktywacyjny
- **Tryb ciemny** — Wsparcie dla jasnego i ciemnego motywu
- **Załączniki** — Przesyłanie plików przez S3 (Railway Bucket)
- **Powiadomienia e-mail** — Automatyczne powiadomienia o zmianach statusu

---

## 🚀 Uruchomienie lokalne

### Wymagania

- **Node.js** 20.20.2 (`.nvmrc` / `.node-version`)
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
Obraz developerski i produkcyjny używa Node.js `20.20.2`, tak samo jak `.nvmrc`.

### Uruchomienie bez Dockera

```bash
# Przełącz Node, jeśli używasz nvm
nvm use

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
Produkcyjny auto-deploy jest uruchamiany z brancha `main`.

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
| `APP_URL` | Publiczny URL aplikacji | `https://twoja-aplikacja.up.railway.app` |
| `NODE_ENV` | Tryb pracy aplikacji | `production` |
| `EMAIL_FROM` | Zweryfikowany nadawca Brevo | `FixIT <sender@proton.me>` |
| `BREVO_API_KEY` | Klucz Brevo API do wysyłki przez HTTPS, rekomendowane na Railway | `xkeysib-...` |
| `SMTP_HOST` | Opcjonalny fallback SMTP, ignorowany gdy ustawiono `BREVO_API_KEY` | |
| `SMTP_PORT` | Opcjonalny port SMTP | `465` |
| `SMTP_SECURE` | Opcjonalny TLS/SSL dla SMTP | `true` |
| `SMTP_USER` | Opcjonalny użytkownik SMTP | |
| `SMTP_PASSWORD` | Opcjonalne hasło SMTP | |
| `SMTP_TIMEOUT_MS` | Timeout SMTP/Brevo API | `20000` |
| `S3_ENDPOINT` | Endpoint S3 (Railway Bucket) | |
| `S3_ACCESS_KEY_ID` | Klucz dostępu S3 | |
| `S3_SECRET_ACCESS_KEY` | Sekretny klucz S3 | |
| `S3_BUCKET` | Nazwa bucketa S3 | |
| `FIXIT_DATA_PROVIDER` | Wymuszenie storage runtime | `prisma` |
| `FIXIT_RUN_SEED` | Jawne uruchomienie seeda/bootstrapu | `true` tylko jednorazowo |
| `FIXIT_BOOTSTRAP_ADMIN_EMAIL` | E-mail admina tworzonego przez seed | `admin@bagietka.pl` |
| `FIXIT_BOOTSTRAP_ADMIN_PASSWORD` | Tymczasowe hasło bootstrap admina | silne hasło jednorazowe |
| `PORT` | Port aplikacji | `8080` |

### Dostęp użytkowników

- Każdy pracownik z adresem `@bagietka.pl` może samodzielnie założyć konto przez `/register`.
- Samodzielna rejestracja tworzy konto z rolą `REPORTER`.
- Administrator może dodać użytkownika ręcznie w `/admin/users` i opcjonalnie wysłać jednorazowy link aktywacyjny e-mailem.
- Produkcyjna wysyłka na Railway działa przez Brevo API (`BREVO_API_KEY`) i zweryfikowany `EMAIL_FROM`. Jeśli wysyłka się nie powiedzie, panel pokaże awaryjny link aktywacyjny. Przy istniejącym aktywnym koncie bez ustawionego hasła można kliknąć `Link`, aby wygenerować i wysłać nowy link.
- Usunięcie konta jest dostępne tylko dla użytkowników bez historii zgłoszeń/komentarzy/treści. Konta z historią należy dezaktywować, aby zachować spójność danych.
- Konta tworzone przez admina mają wymuszoną zmianę hasła przy pierwszym logowaniu.
- Seed produkcyjny jest wyłączony domyślnie. Bootstrap admina uruchamiaj tylko świadomie przez `FIXIT_RUN_SEED=true` i silne tymczasowe hasło w `FIXIT_BOOTSTRAP_ADMIN_PASSWORD`.

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
| **Brevo API / Nodemailer** | Wysyłanie e-maili (Brevo API na Railway, SMTP jako fallback) |
| **Playwright** | Testy E2E |
| **Vitest** | Testy jednostkowe |

---

## 📄 Licencja

Projekt wewnętrzny — **Bagietka Sp. z o.o.**
