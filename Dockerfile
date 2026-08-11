# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first so the dependency layer is reused whenever only source changed.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
# tsconfig excludes src/tests, so the build output is production code only.
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Set before `npm ci` so npm itself honours it, and kept for Express's own
# production paths. The API never reads NODE_ENV directly.
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# dist/ only: swagger.ts resolves its JSDoc glob from __dirname, so the compiled
# controllers under dist/ are what /api/docs reads. No src/ needed at runtime.
COPY --from=build /app/dist ./dist

# Nothing is written at runtime, so the app owns none of its files.
USER node

EXPOSE 3001

# Shell form so ${PORT} is expanded; the app defaults to 3001 the same way.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/api/health" > /dev/null || exit 1

CMD ["node", "dist/index.js"]
