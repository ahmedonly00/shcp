# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN addgroup -S shcp && adduser -S shcp -G shcp

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=shcp:shcp src/ ./src/
COPY --chown=shcp:shcp package.json .

USER shcp

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
