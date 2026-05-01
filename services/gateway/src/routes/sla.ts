import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";

export async function slaRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  // Get SLA records
  app.get("/v1/sla", async (
    req: FastifyRequest<{ Querystring: { projectId: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, limit = "12" } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const records = await prisma.slaRecord.findMany({
      where: { projectId },
      orderBy: { periodStart: "desc" },
      take: Math.min(Number(limit), 24),
    });

    return reply.send({ data: records });
  });

  // Compute and store SLA for the last period
  app.post("/v1/sla/compute", async (
    req: FastifyRequest<{ Body: { projectId: string; period?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, period = "daily" } = req.body;

    const periodMs = period === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - periodMs);

    const [totalTraces, errorTraces, endpoints] = await Promise.all([
      prisma.apiTrace.count({ where: { projectId, timestamp: { gte: periodStart, lte: periodEnd } } }),
      prisma.apiTrace.count({ where: { projectId, timestamp: { gte: periodStart, lte: periodEnd }, statusCode: { gte: 500 } } }),
      prisma.apiEndpoint.findMany({ where: { projectId }, select: { p99LatencyMs: true, healthScore: true } }),
    ]);

    const errorRate = totalTraces > 0 ? errorTraces / totalTraces : 0;
    const uptimePercent = Math.max(0, (1 - errorRate) * 100);
    const avgP99 = endpoints.length > 0
      ? Math.round(endpoints.reduce((s: number, e: any) => s + e.p99LatencyMs, 0) / endpoints.length)
      : 0;

    const slaTarget = 99.9;
    const slaAchieved = uptimePercent >= slaTarget;

    const record = await prisma.slaRecord.create({
      data: {
        id: generateId(),
        projectId,
        period,
        periodStart,
        periodEnd,
        uptimePercent,
        p99LatencyMs: avgP99,
        errorRate,
        totalRequests: totalTraces,
        slaTarget,
        slaAchieved,
      },
    });

    return reply.status(201).send({ data: record });
  });

  // Current SLA status
  app.get("/v1/sla/current", async (
    req: FastifyRequest<{ Querystring: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalTraces, errorTraces, endpoints] = await Promise.all([
      prisma.apiTrace.count({ where: { projectId, timestamp: { gte: since24h } } }),
      prisma.apiTrace.count({ where: { projectId, timestamp: { gte: since24h }, statusCode: { gte: 500 } } }),
      prisma.apiEndpoint.findMany({
        where: { projectId },
        select: { healthScore: true, healthStatus: true, p99LatencyMs: true },
      }),
    ]);

    const errorRate = totalTraces > 0 ? errorTraces / totalTraces : 0;
    const uptime = ((1 - errorRate) * 100).toFixed(3);
    const healthyEndpoints = endpoints.filter((e: any) => e.healthStatus === "healthy").length;

    return reply.send({
      data: {
        uptime: `${uptime}%`,
        slaTarget: "99.9%",
        slaAchieved: parseFloat(uptime) >= 99.9,
        totalRequests24h: totalTraces,
        errorRate24h: errorRate,
        totalEndpoints: endpoints.length,
        healthyEndpoints,
        degradedEndpoints: endpoints.filter((e: any) => e.healthStatus === "degraded").length,
        downEndpoints: endpoints.filter((e: any) => e.healthStatus === "down").length,
        avgP99Ms: endpoints.length > 0
          ? Math.round(endpoints.reduce((s: number, e: any) => s + e.p99LatencyMs, 0) / endpoints.length)
          : 0,
      },
    });
  });
}
