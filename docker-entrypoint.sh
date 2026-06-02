#!/bin/sh
set -e

echo "=== FixIT entrypoint ==="

# --- Validate required vars ---
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Application cannot start without a database."
  exit 1
fi

# --- Handle DATABASE_URL SSL mode for Railway ---
# Railway PostgreSQL requires SSL. Ensure sslmode=require is present.
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

# --- Generate Prisma client ---
# Required before migrations or app start, even if already generated at build time
echo "Generating Prisma client..."
npx prisma generate

# --- Run Prisma migrations ---
if [ -d "prisma/migrations" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
  echo "Migrations complete."
else
  echo "WARNING: No prisma/migrations directory found. Skipping migrations."
fi

# --- Optionally seed the database ---
# Set FIXIT_RUN_SEED=true to seed on first deploy, then remove the env var
if [ "${FIXIT_RUN_SEED}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
  echo "Seed complete."
fi

# --- Start the application ---
echo "Starting application..."
exec "$@"
