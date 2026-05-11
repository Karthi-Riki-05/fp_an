# syntax=docker/dockerfile:1.7

# ---- shared deps stage ------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache wget openssl
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- prisma client generation -----------------------------------------------
# Run prisma generate so TypeScript can find @prisma/client types at compile
# time. Schema must be present for this to work.
FROM node:20-alpine AS prisma-gen
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY backend/prisma ./prisma
COPY backend/package.json ./
RUN npx prisma generate

# ---- dev stage (used by docker-compose.local.yml) ---------------------------
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache wget openssl bash
COPY --from=prisma-gen /app/node_modules ./node_modules
COPY backend/ ./
ENV NODE_ENV=development
EXPOSE 4000
# On dev startup: regenerate client (covers schema edits via bind mount),
# push the schema to the DB, run seed, then start Nest in watch mode.
# All three are idempotent.
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate --accept-data-loss && node prisma/seed.js && npm run start:dev"]

# ---- builder ----------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=prisma-gen /app/node_modules ./node_modules
COPY --from=prisma-gen /app/prisma ./prisma
COPY backend/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---- production runtime -----------------------------------------------------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache wget openssl tini
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
# In prod: prisma migrate deploy (Phase 6 generates the migrations) +
# optionally seed (idempotent), then run the built JS.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
