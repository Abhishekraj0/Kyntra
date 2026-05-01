import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

const ANALYZER_URL = process.env["ANALYZER_URL"] ?? "http://localhost:3002";

export async function testsRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  app.get("/v1/tests", async (
    req: FastifyRequest<{ Querystring: { projectId: string; status?: string; type?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, status, type } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId is required" });

    const tests = await prisma.testCase.findMany({
      where: {
        projectId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return reply.send({ data: tests });
  });

  app.get("/v1/tests/:testId", async (
    req: FastifyRequest<{ Params: { testId: string } }>,
    reply: FastifyReply
  ) => {
    const test = await prisma.testCase.findUnique({ where: { id: req.params.testId } });
    if (!test) return reply.status(404).send({ error: "Test not found" });
    return reply.send({ data: test });
  });

  // Generate tests for an endpoint
  app.post("/v1/tests/generate", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { projectId: string; endpointId: string; framework?: string };

    const response = await fetch(`${ANALYZER_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "test_generation",
        projectId: body.projectId,
        options: { endpointId: body.endpointId, framework: body.framework ?? "vitest" },
      }),
    });

    const data = await response.json();
    return reply.status(response.status).send(data);
  });
}
