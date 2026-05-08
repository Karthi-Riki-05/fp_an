# syntax=docker/dockerfile:1.7

# ---- shared deps stage ------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache wget openssl
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- dev stage (used by docker-compose.local.yml) ---------------------------
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache wget openssl
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
ENV NODE_ENV=development
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

# ---- builder ----------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
RUN npx prisma generate || true
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
CMD ["node", "dist/main.js"]
