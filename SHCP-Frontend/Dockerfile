# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Enable pnpm via corepack (project uses pnpm-lock.yaml)
RUN corepack enable

COPY package.json pnpm-lock.yaml ./

# Install all deps including peer (react/react-dom are listed as optional peers)
RUN pnpm install --frozen-lockfile

COPY . .

# Accept runtime URLs as build-time args so the JS bundle knows where to call
ARG VITE_API_BASE_URL=http://localhost:8080
ARG VITE_SIGNALING_URL=http://localhost:3001
ARG VITE_GOOGLE_FIT_CLIENT_ID=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SIGNALING_URL=$VITE_SIGNALING_URL \
    VITE_GOOGLE_FIT_CLIENT_ID=$VITE_GOOGLE_FIT_CLIENT_ID

RUN pnpm run build

# ── Stage 2: serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS runtime

RUN apk add --no-cache gettext

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

CMD ["/start.sh"]
