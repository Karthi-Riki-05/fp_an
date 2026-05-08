# syntax=docker/dockerfile:1.7

# ---- shared deps stage ------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache wget
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- dev stage (used by docker-compose.local.yml) ---------------------------
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache wget
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- builder ----------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# ---- production runtime (Next.js standalone output) ------------------------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache wget tini
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/messages ./messages
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
