# Hotel OS v2 public site — Vite React SPA (same stack as desk). Build from monorepo root `v2/`.
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @hos-v2/web...

FROM deps AS build
ARG VITE_DESK_ORIGIN=https://desk-v2.165.22.211.20.sslip.io
ENV VITE_DESK_ORIGIN=$VITE_DESK_ORIGIN
COPY packages/ui packages/ui
COPY apps/web apps/web
RUN pnpm --filter @hos-v2/ui build && pnpm --filter @hos-v2/web build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
