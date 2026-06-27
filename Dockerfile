# syntax=docker/dockerfile:1
#
# Epoch Mapper — standalone site image (the public web app).
#
# This is independent of the npm package @northbridgetechnology/epoch-mapper:
# the site builds entirely from local source, while the package is published
# separately by .github/workflows/publish.yml. No registry auth is needed here.
#
#   docker compose up -d --build       # local dev / build from source
#   docker compose pull && up -d        # run the CI-built image from GHCR

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Install deps first for layer caching. (The `prepare` script tries to build the
# library bundle; it harmlessly no-ops here since the source isn't copied yet and
# the site doesn't need it.)
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0

# Next standalone server bundle + static assets.
# public/ is optional — Next.js projects don't require it.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p ./public

EXPOSE 3100
CMD ["node", "server.js"]
