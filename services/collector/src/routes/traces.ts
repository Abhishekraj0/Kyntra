import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { normalizePath, generateId, sanitizePayload, sanitizeHeaders } from "@kyntra/shared";

const TraceSchema = z.object({
  projectId: z.string(),
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  url: z.string(),
  statusCode: z.number().int(),
  requestHeaders: z.record(z.string()).default({}),
  requestBody: z.unknown().optional(),
  responseHeaders: z.record(z.string()).default({}),
  responseBody: z.unknown().optional(),
  durationMs: z.number().int(),
  environment: z.string().default("production"),
  serviceId: z.string().default("unknown"),
  tags: z.array(z.string()).default([]),
  timestamp: z.string(),
});

const TraceBatchSchema = z.object({
  projectId: z.string(),
  apiKey: z.string(),
  traces: z.array(TraceSchema),
  sentAt: z.string(),
  sdkVersion: z.string().default("unknown"),
});

export async function tracesRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/traces",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const apiKey = req.headers["x-kyntra-key"];
      if (!apiKey) {
        return reply.status(401).send({ error: "Missing X-Kyntra-Key header" });
      }

      const project = await prisma.project.findUnique({
        where: { apiKey: String(apiKey) },
        select: { id: true },
      });

      if (!project) {
        return reply.status(401).send({ error: "Invalid API key" });
      }

      const parsed = TraceBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }

      const { traces } = parsed.data;
      const batchId = generateId("batch");

      // Insert traces and upsert endpoints concurrently
      const traceData = traces.map((trace) => ({
        id: generateId(),
        projectId: project.id,
        traceId: trace.traceId,
        spanId: trace.spanId,
        parentSpanId: trace.parentSpanId ?? null,
        method: trace.method,
        url: trace.url.slice(0, 2048),
        path: normalizePath(trace.url),
        statusCode: trace.statusCode,
        requestHeaders: sanitizeHeaders(trace.requestHeaders) as object,
        requestBody: sanitizePayload(trace.requestBody) as object,
        responseHeaders: sanitizeHeaders(trace.responseHeaders) as object,
        responseBody: sanitizePayload(trace.responseBody) as object,
        durationMs: trace.durationMs,
        environment: trace.environment,
        serviceId: trace.serviceId,
        tags: trace.tags,
        timestamp: new Date(trace.timestamp),
      }));

      await prisma.apiTrace.createMany({ data: traceData, skipDuplicates: true });

      // Upsert endpoints (aggregate stats)
      const endpointGroups = new Map<string, typeof traceData>();
      for (const trace of traceData) {
        const key = `${trace.method}:${trace.path}`;
        const group = endpointGroups.get(key) ?? [];
        group.push(trace);
        endpointGroups.set(key, group);
      }

      for (const [, group] of endpointGroups) {
        const first = group[0]!;
        const durations = group.map((t) => t.durationMs).sort((a, b) => a - b);
        const errorCount = group.filter((t) => t.statusCode >= 400).length;

        const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
        const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
        const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;

        await prisma.apiEndpoint.upsert({
          where: { projectId_method_path: { projectId: project.id, method: first.method, path: first.path } },
          create: {
            id: generateId(),
            projectId: project.id,
            method: first.method,
            path: first.path,
            firstSeen: new Date(first.timestamp),
            lastSeen: new Date(first.timestamp),
            totalCalls: group.length,
            errorRate: errorCount / group.length,
            successRate: 1 - errorCount / group.length,
            p50LatencyMs: p50,
            p95LatencyMs: p95,
            p99LatencyMs: p99,
          },
          update: {
            lastSeen: new Date(first.timestamp),
            totalCalls: { increment: group.length },
          },
        });
      }

      return reply.status(202).send({ accepted: traces.length, batchId });
    }
  );
}
