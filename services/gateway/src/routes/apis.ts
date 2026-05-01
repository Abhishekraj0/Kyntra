import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { calculateHealthScore, healthScoreToStatus, p50, p95, p99 } from "@kyntra/shared";

export async function apisRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  // Get all API endpoints for a project
  app.get("/v1/apis", async (req: FastifyRequest<{ Querystring: { projectId: string; environment?: string } }>, reply: FastifyReply) => {
    const { projectId, environment } = req.query;

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });

    const endpoints = await prisma.apiEndpoint.findMany({
      where: { projectId },
      orderBy: { totalCalls: "desc" },
    });

    const summary = {
      total: endpoints.length,
      healthy: endpoints.filter((e: any) => e.healthStatus === "healthy").length,
      degraded: endpoints.filter((e: any) => e.healthStatus === "degraded").length,
      down: endpoints.filter((e: any) => e.healthStatus === "down").length,
      avgLatencyMs: endpoints.length > 0
        ? Math.round(endpoints.reduce((sum: number, e: any) => sum + e.p50LatencyMs, 0) / endpoints.length)
        : 0,
      errorRate: endpoints.length > 0
        ? endpoints.reduce((sum: number, e: any) => sum + e.errorRate, 0) / endpoints.length
        : 0,
    };

    return reply.send({ data: { endpoints, summary } });
  });

  // Get traces for an endpoint
  app.get("/v1/traces", async (
    req: FastifyRequest<{ Querystring: { projectId: string; endpointId?: string; path?: string; method?: string; limit?: string; cursor?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, path, method, limit = "50", cursor } = req.query;

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });

    const take = Math.min(Number(limit), 200);

    const traces = await prisma.apiTrace.findMany({
      where: {
        projectId,
        ...(path ? { path } : {}),
        ...(method ? { method } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: take + 1,
    });

    const hasMore = traces.length > take;
    const items = traces.slice(0, take);

    return reply.send({
      data: {
        traces: items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
        hasMore,
        total: items.length,
      },
    });
  });

  // Get endpoint statistics
  app.get("/v1/apis/:endpointId/stats", async (
    req: FastifyRequest<{ Params: { endpointId: string }; Querystring: { windowMinutes?: string } }>,
    reply: FastifyReply
  ) => {
    const { endpointId } = req.params;
    const windowMinutes = Number(req.query.windowMinutes ?? 60);

    const endpoint = await prisma.apiEndpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint) return reply.status(404).send({ error: "Endpoint not found" });

    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const traces = await prisma.apiTrace.findMany({
      where: { projectId: endpoint.projectId, path: endpoint.path, method: endpoint.method, timestamp: { gte: since } },
      select: { statusCode: true, durationMs: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    });

    // Build time series (5-minute buckets)
    const buckets = new Map<number, { latencies: number[]; errors: number; total: number }>();
    for (const trace of traces) {
      const bucket = Math.floor(trace.timestamp.getTime() / (5 * 60 * 1000)) * 5 * 60 * 1000;
      const b = buckets.get(bucket) ?? { latencies: [], errors: 0, total: 0 };
      b.latencies.push(trace.durationMs);
      b.total++;
      if (trace.statusCode >= 400) b.errors++;
      buckets.set(bucket, b);
    }

    const timeSeries = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, b]) => ({
        timestamp: new Date(ts).toISOString(),
        avgLatencyMs: b.latencies.reduce((s, v) => s + v, 0) / b.latencies.length,
        p99LatencyMs: p99(b.latencies),
        errorRate: b.errors / b.total,
        requestCount: b.total,
      }));

    const allLatencies = traces.map((t: any) => t.durationMs);
    const errorCount = traces.filter((t: any) => t.statusCode >= 400).length;

    return reply.send({
      data: {
        endpoint,
        stats: {
          totalCalls: traces.length,
          errorRate: traces.length > 0 ? errorCount / traces.length : 0,
          p50Ms: p50(allLatencies),
          p95Ms: p95(allLatencies),
          p99Ms: p99(allLatencies),
        },
        timeSeries,
      },
    });
  });
}
