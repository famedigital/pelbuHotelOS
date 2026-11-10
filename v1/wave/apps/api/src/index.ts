import "./load-env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { jwtSecret } from "./env.js";
import { registerAuthRoutes } from "./auth.js";
import { registerSnapshotRoutes, buildDeskSnapshot } from "./snapshot.js";
import { registerSyncRoutes } from "./sync-replay.js";
import { registerReportRoutes } from "./reports.js";
import { registerSaasRoutes, assertLicenseAllowsWrite } from "./saas.js";
import { registerMarketplaceRoutes } from "./marketplace.js";
import { registerRegistryRoutes } from "./registry.js";
import { registerHardwareFxRoutes } from "./hardware-fx.js";
import { registerDomainRoutes } from "./domain-routes.js";
import { isDeskCutoverEnabled } from "./cutover.js";

const PORT = Number(process.env.PORT || 4100);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(jwt, { secret: jwtSecret() });
  await app.register(websocket);

  app.get("/health", async () => ({
    ok: true,
    service: "hotel-os-api",
    version: "2.0.0",
    deskCutover: isDeskCutoverEnabled(),
  }));

  // SaaS license gate: a hard-locked tenant can read but not write.
  // (Previously the license error was caught and ignored, so hard_lock never applied.)
  const LICENSE_EXEMPT = ["/v1/auth", "/v1/superadmin", "/v1/marketplace", "/v1/onboard"];
  app.addHook("preHandler", async (req, reply) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
    if (!req.url.startsWith("/v1/")) return;
    if (LICENSE_EXEMPT.some((p) => req.url.startsWith(p))) return;
    let propertyId: string | undefined;
    try {
      const decoded = await req.jwtVerify<{ propertyId: string }>();
      propertyId = decoded.propertyId;
    } catch {
      return; // unauthenticated — the route itself answers 401
    }
    if (!propertyId) return;
    try {
      await assertLicenseAllowsWrite(propertyId);
    } catch (err) {
      return reply.code(423).send({
        error: err instanceof Error ? err.message : "License locked",
      });
    }
  });

  await registerAuthRoutes(app);
  await registerSnapshotRoutes(app);
  await registerSyncRoutes(app);
  await registerReportRoutes(app);
  await registerSaasRoutes(app);
  await registerMarketplaceRoutes(app);
  await registerRegistryRoutes(app);
  await registerHardwareFxRoutes(app);
  await registerDomainRoutes(app);

  app.get("/v1/ws", { websocket: true }, (socket, req) => {
    const q = req.query as { token?: string };
    void (async () => {
      // A desk token is REQUIRED and the property comes from the token —
      // never from the query string (that leaked any hotel's guest list).
      let propertyId: string;
      try {
        if (!q.token) throw new Error("token required");
        const decoded = app.jwt.verify<{ propertyId?: string }>(q.token);
        if (!decoded.propertyId) throw new Error("invalid token");
        propertyId = decoded.propertyId;
      } catch {
        socket.send(JSON.stringify({ type: "error", error: "Unauthorized" }));
        socket.close(1008, "Unauthorized");
        return;
      }
      const push = async () => {
        try {
          const snap = await buildDeskSnapshot(propertyId);
          socket.send(JSON.stringify({ type: "snapshot", payload: snap }));
        } catch (err) {
          socket.send(
            JSON.stringify({
              type: "error",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      };
      await push();
      const timer = setInterval(() => void push(), 15000);
      socket.on("close", () => clearInterval(timer));
    })();
  });

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Hotel OS API v2 listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
