import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { healthRoutes } from "./routes/health.js";
import { tracesRoutes } from "./routes/traces.js";
import { eventsRoutes } from "./routes/events.js";
import { prisma } from "./db/client.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const HOST = process.env["HOST"] ?? "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    ...(process.env["NODE_ENV"] !== "production"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  },
});

async function main(): Promise<void> {
  // Plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 10000,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Too Many Requests",
      message: "Rate limit exceeded",
    }),
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(tracesRoutes);
  await app.register(eventsRoutes);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Start server
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Collector listening on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start collector:", err);
  process.exit(1);
});
