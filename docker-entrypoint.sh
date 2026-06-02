#!/bin/sh
set -e

echo "=== FixIT entrypoint ==="

# --- Handle DATABASE_URL SSL mode for Railway ---
# Railway PostgreSQL requires SSL. Ensure sslmode=require is present.
if [ -n "$DATABASE_URL" ]; then
  case "$DATABASE_URL" in
    *sslmode=*) 
      echo "DATABASE_URL already has sslmode configured"
      ;;
    *)
      echo "Appending ?sslmode=require to DATABASE_URL (Railway requires SSL)"
      DATABASE_URL="${DATABASE_URL}?sslmode=require"
      export DATABASE_URL
      ;;
  esac
fi

# --- Run Prisma migrations ---
if [ -d "prisma/migrations" ] && [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
  echo "Migrations complete."
else
  echo "Skipping migrations (no prisma/migrations directory or no DATABASE_URL)"
fi

# --- Optionally seed the database ---
# Set FIXIT_RUN_SEED=true to seed on first deploy
if [ "${FIXIT_RUN_SEED}" = "true" ] && [ -n "$DATABASE_URL" ]; then
  echo "Seeding database..."
  npx prisma db seed
  echo "Seed complete."
fi

# --- Start the application ---
echo "Starting application..."
exec "$@"
