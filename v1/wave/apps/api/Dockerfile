FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/rates/package.json packages/rates/
COPY packages/core/package.json packages/core/
RUN pnpm install --filter @hotel-os/api... --frozen-lockfile=false

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/db packages/db
COPY packages/rates packages/rates
COPY packages/core packages/core
COPY apps/api apps/api
# @hotel-os/core runs from dist/ in production (Node ESM); build it first.
RUN pnpm --filter @hotel-os/core build && pnpm --filter @hotel-os/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4100
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4100
CMD ["node", "--max-old-space-size=512", "dist/index.js"]
