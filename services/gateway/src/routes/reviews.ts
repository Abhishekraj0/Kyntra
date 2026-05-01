import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

const ANALYZER_URL = process.env["ANALYZER_URL"] ?? "http://localhost:3002";

export async function reviewsRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  app.get("/v1/reviews", async (
    req: FastifyRequest<{ Querystring: { projectId: string; status?: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, status, limit = "20" } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId is required" });

    const reviews = await prisma.codeReview.findMany({
      where: { projectId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit), 100),
    });

    return reply.send({ data: reviews });
  });

  app.get("/v1/reviews/:reviewId", async (
    req: FastifyRequest<{ Params: { reviewId: string } }>,
    reply: FastifyReply
  ) => {
    const review = await prisma.codeReview.findUnique({ where: { id: req.params.reviewId } });
    if (!review) return reply.status(404).send({ error: "Review not found" });
    return reply.send({ data: review });
  });

  // Trigger a code review via analyzer service
  app.post("/v1/reviews", async (req: FastifyRequest, reply: FastifyReply) => {
    const response = await fetch(`${ANALYZER_URL}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  });
}
