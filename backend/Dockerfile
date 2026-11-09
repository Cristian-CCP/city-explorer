# syntax=docker/dockerfile:1

# =========================================================
# Etapa 1 (deps-dev): todas las dependencias (incluye Jest)
# =========================================================
FROM node:20-alpine AS deps-dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# =========================================================
# Etapa 2 (test): ejecuta las pruebas dentro de Docker.
# Solo se construye si se pide explícitamente:
#   docker build --target test ./backend
# =========================================================
FROM deps-dev AS test
ENV NODE_ENV=test
COPY src ./src
COPY tests ./tests
RUN npm test

# =========================================================
# Etapa 3 (deps-prod): solo dependencias de producción
# =========================================================
FROM node:20-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# =========================================================
# Etapa 4 (runtime): imagen final mínima y sin root
# =========================================================
FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="city-explorer-backend" \
      org.opencontainers.image.description="API REST de City Explorer (Node.js 20 + Express)" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# El usuario "node" (uid 1000) ya existe en la imagen oficial
COPY --from=deps-prod --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "src/server.js"]
