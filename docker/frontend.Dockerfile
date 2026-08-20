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
# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
# Node's default heap is sized from available RAM and overshoots on small
# instances: on a 2 GB box the build OOMs with "Ineffective mark-compacts near
# heap limit". Cap it below physical RAM so V8 collects instead of dying, and
# let swap absorb the peak. Override with --build-arg NODE_BUILD_MEMORY=4096 on
# a larger builder.
ARG NODE_BUILD_MEMORY=1536
ENV NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEMORY}"
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
