# Hotel OS v2 desk — build from monorepo root context `v2/`
# Same-origin API: build with VITE_API_URL="" so nginx proxies /v1 and /health.
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/domain/package.json packages/domain/
COPY packages/ui/package.json packages/ui/
COPY apps/desk/package.json apps/desk/
RUN pnpm install --frozen-lockfile --filter @hos-v2/desk...

FROM deps AS build
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
COPY packages/domain packages/domain
COPY packages/ui packages/ui
COPY apps/desk apps/desk
RUN pnpm --filter @hos-v2/domain build \
  && pnpm --filter @hos-v2/ui build \
  && pnpm --filter @hos-v2/desk build

FROM nginx:alpine
COPY apps/desk/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/desk/dist /usr/share/nginx/html
EXPOSE 80
