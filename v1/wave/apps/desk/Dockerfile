FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/desk/package.json apps/desk/
COPY packages/engine/package.json packages/engine/
COPY packages/ui/package.json packages/ui/
COPY packages/rates/package.json packages/rates/
COPY packages/hardware/package.json packages/hardware/
COPY packages/db/package.json packages/db/
RUN pnpm install --filter @hotel-os/desk... --frozen-lockfile=false
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/desk apps/desk
RUN pnpm --filter @hotel-os/desk build

FROM nginx:alpine
COPY apps/desk/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/desk/dist /usr/share/nginx/html
EXPOSE 80
