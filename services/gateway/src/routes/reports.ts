import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";

export async function reportsRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  app.get("/v1/reports", async (
    req: FastifyRequest<{ Querystring: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId is required" });

    const reports = await prisma.report.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return reply.send({ data: reports });
  });

  // Generate a system health report
  app.post("/v1/reports/generate", async (
    req: FastifyRequest<{ Body: { projectId: string; type?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, type = "weekly" } = req.body;

    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [endpointCount, traceCount, errorTraceCount, reviews, tests] = await Promise.all([
      prisma.apiEndpoint.count({ where: { projectId } }),
      prisma.apiTrace.count({ where: { projectId, timestamp: { gte: start } } }),
      prisma.apiTrace.count({ where: { projectId, timestamp: { gte: start }, statusCode: { gte: 400 } } }),
      prisma.codeReview.count({ where: { projectId, createdAt: { gte: start } } }),
      prisma.testCase.count({ where: { projectId, createdAt: { gte: start } } }),
    ]);

    const errorRate = traceCount > 0 ? (errorTraceCount / traceCount) * 100 : 0;

    const report = await prisma.report.create({
      data: {
        id: generateId(),
        projectId,
        type,
        title: `Weekly System Health Report — ${now.toLocaleDateString()}`,
        period: { start: start.toISOString(), end: now.toISOString() },
        sections: [
          {
            title: "Summary",
            content: `## System Health Report\n\n- **API Endpoints Monitored:** ${endpointCount}\n- **Total API Calls (7d):** ${traceCount.toLocaleString()}\n- **Error Rate:** ${errorRate.toFixed(2)}%\n- **Code Reviews:** ${reviews}\n- **Tests Generated:** ${tests}`,
          },
          {
            title: "API Health",
            content: `Monitored ${endpointCount} endpoints with ${traceCount.toLocaleString()} requests. Overall error rate: ${errorRate.toFixed(2)}%.`,
          },
        ],
      },
    });

    return reply.status(201).send({ data: report });
  });
}
