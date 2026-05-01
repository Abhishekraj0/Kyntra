import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { analyzeRoutes } from "./routes/analyze.js";
import { reviewRoutes } from "./routes/reviews.js";
import { createWorker } from "./workers/analysis-worker.js";

const PORT = Number(process.env["PORT"] ?? 3002);
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

async function main(): Promise<void> {
  await app.register(cors, { origin: true });

  app.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok", service: "analyzer", timestamp: new Date().toISOString() });
  });

  await app.register(analyzeRoutes, { prisma });
  await app.register(reviewRoutes, { prisma });

  // Start BullMQ worker
  const worker = createWorker(prisma);
  app.log.info("BullMQ analysis worker started (concurrency: 3)");

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await worker.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Analyzer listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start analyzer:", err);
  process.exit(1);
});
