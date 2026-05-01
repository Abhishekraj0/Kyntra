FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY services/collector/package.json ./services/collector/
COPY services/gateway/package.json ./services/gateway/
RUN pnpm install --no-frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/collector/node_modules ./services/collector/node_modules
COPY --from=deps /app/services/gateway/node_modules ./services/gateway/node_modules
COPY packages/shared ./packages/shared
COPY services/collector/prisma ./services/collector/prisma
COPY services/gateway ./services/gateway
COPY tsconfig.base.json ./
RUN pnpm --filter=@kyntra/shared build
RUN pnpm --filter=@kyntra/collector prisma:generate
RUN pnpm --filter=@kyntra/gateway build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/gateway/dist ./dist
COPY --from=build /app/services/gateway/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "dist/index.js"]
