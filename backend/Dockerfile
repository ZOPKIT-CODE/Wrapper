# Backend Dockerfile
# Multi-stage build for optimized production image

# Development stage (includes dev dependencies for hot reload)
FROM node:20-alpine AS development

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/

RUN pnpm install --frozen-lockfile --filter wrapper-backend

COPY backend/ backend/

WORKDIR /app/backend

EXPOSE 3000

CMD ["pnpm", "run", "dev"]

# Production stage
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/

RUN pnpm install --frozen-lockfile --filter wrapper-backend

COPY backend/ backend/

RUN cd backend && pnpm run build

RUN chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/bootstrap.js"]
