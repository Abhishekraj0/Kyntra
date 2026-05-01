import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_req, reply) => {
    return reply.send({
      status: "ok",
      service: "collector",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
}
