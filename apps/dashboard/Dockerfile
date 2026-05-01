FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --no-frozen-lockfile
COPY packages/shared ./packages/shared
COPY apps/dashboard ./apps/dashboard
COPY tsconfig.base.json ./
RUN pnpm --filter=@kyntra/shared build
RUN pnpm --filter=@kyntra/dashboard build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003
COPY --from=build /app/apps/dashboard/.next ./.next
COPY --from=build /app/apps/dashboard/node_modules ./node_modules
COPY --from=build /app/apps/dashboard/package.json ./
EXPOSE 3003
CMD ["node_modules/.bin/next", "start", "-p", "3003"]
