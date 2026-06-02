FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ─── deps: install ALL dependencies (including dev — needed for build) ───
FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ─── builder: compile the application ───
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

# ─── runner: production image (no devDependencies, non-root user) ───
FROM base AS runner
ENV NODE_ENV=production

# Create .data directory and ensure /app is writable by the node user
# (needed for prisma generate in entrypoint and JSON file store)
RUN mkdir -p /app/.data

COPY --from=base /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Install only production dependencies (smaller image, fewer attack vectors)
RUN npm ci --omit=dev

# Copy Prisma-generated client (output of db:generate in builder)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Ensure all files are owned by the node user (needed for prisma generate in entrypoint)
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
