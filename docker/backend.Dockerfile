# syntax=docker/dockerfile:1.7

# ---- shared deps stage -------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache wget openssl
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- prisma client generation ------------------------------------------------
FROM node:20-alpine AS prisma-gen
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY backend/prisma ./prisma
COPY backend/package.json ./
RUN npx prisma generate

# ---- dev stage (used by docker-compose.local.yml) ----------------------------
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache wget openssl bash
COPY --from=prisma-gen /app/node_modules ./node_modules
COPY backend/ ./
ENV NODE_ENV=development
EXPOSE 4000
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate --accept-data-loss && node prisma/seed.js && npm run start:dev"]

# ---- production runtime (plain JS — no build step needed) -------------------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache wget openssl tini
ENV NODE_ENV=production
# node_modules with generated @prisma/client
COPY --from=prisma-gen /app/node_modules ./node_modules
COPY --from=prisma-gen /app/prisma ./prisma
# Application source (no node_modules dir in backend/ thanks to .dockerignore)
COPY backend/ ./
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
# Push schema + seed (both idempotent), then start the Express server
CMD ["sh", "-c", "npm run db:bootstrap && npm start"]
