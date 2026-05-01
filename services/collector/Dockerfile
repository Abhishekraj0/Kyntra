FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
# Copy lockfile if present; fall back gracefully if not
COPY pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/collector/package.json ./services/collector/
RUN pnpm install --no-frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/collector/node_modules ./services/collector/node_modules
COPY packages/shared ./packages/shared
COPY services/collector ./services/collector
COPY tsconfig.base.json ./
RUN pnpm --filter=@kyntra/shared build
RUN pnpm --filter=@kyntra/collector build
RUN pnpm --filter=@kyntra/collector prisma:generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/collector/dist ./dist
COPY --from=build /app/services/collector/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
# Prisma schema needed for migrate at runtime
COPY services/collector/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/index.js"]
