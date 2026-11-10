# Hotel OS v2 API — build from monorepo root context `v2/`
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @hos-v2/api...

FROM deps AS build
RUN pnpm --filter @hos-v2/domain build && pnpm --filter @hos-v2/db build && pnpm --filter @hos-v2/api build
# Point workspace packages at compiled dist for Node runtime (dev still uses src via tsx locally)
RUN node <<'NODE'
const fs = require("fs");
for (const pkg of ["packages/domain", "packages/db"]) {
  const p = `${pkg}/package.json`;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const next = {};
  for (const [k, v] of Object.entries(j.exports || {})) {
    if (typeof v === "string" && v.startsWith("./src/")) {
      next[k] = v.replace("./src/", "./dist/").replace(/\.ts$/, ".js");
    } else {
      next[k] = v;
    }
  }
  j.exports = next;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}
NODE

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4200
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/package.json ./package.json
WORKDIR /app/apps/api
EXPOSE 4200
CMD ["node", "dist/index.js"]
