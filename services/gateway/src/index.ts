import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { PrismaClient } from "@prisma/client";
import { projectsRoutes } from "./routes/projects.js";
import { apisRoutes } from "./routes/apis.js";
import { reviewsRoutes } from "./routes/reviews.js";
import { testsRoutes } from "./routes/tests.js";
import { reportsRoutes } from "./routes/reports.js";
import { githubRoutes } from "./routes/github.js";
import { teamsRoutes } from "./routes/teams.js";
import { alertsRoutes } from "./routes/alerts.js";
import { openapiRoutes } from "./routes/openapi.js";
import { slaRoutes } from "./routes/sla.js";
import { startAlertWorker } from "./workers/alert-worker.js";
import { azureDevopsRoutes } from "./routes/azure-devops.js";
import { bitbucketRoutes } from "./routes/bitbucket.js";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

const prisma = new PrismaClient({ log: ["error"] });

const app = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    ...(process.env["NODE_ENV"] !== "production"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  },
});

// Expose prisma on server instance for middleware
app.decorate("prisma", prisma);

async function main(): Promise<void> {
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });

  app.get("/health", async (_req, reply) => {
    return reply.send({
      status: "ok", service: "gateway",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Core routes
  await app.register(projectsRoutes, { prisma });
  await app.register(apisRoutes, { prisma });
  await app.register(reviewsRoutes, { prisma });
  await app.register(testsRoutes, { prisma });
  await app.register(reportsRoutes, { prisma });

  // M3: GitHub, Azure DevOps, Bitbucket
  await app.register(githubRoutes, { prisma });
  await app.register(azureDevopsRoutes, { prisma });
  await app.register(bitbucketRoutes, { prisma });

  // M5: Teams, Alerts, OpenAPI, SLA
  await app.register(teamsRoutes, { prisma });
  await app.register(alertsRoutes, { prisma });
  await app.register(openapiRoutes, { prisma });
  await app.register(slaRoutes, { prisma });

  // M6: Start background alert worker
  const alertTimer = startAlertWorker(prisma);

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    clearInterval(alertTimer);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Gateway listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start gateway:", err);
  process.exit(1);
});
