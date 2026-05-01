import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateId } from "@kyntra/shared";

const CreateAlertRuleSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["threshold", "anomaly", "health_score", "error_spike"]),
  condition: z.object({
    metric: z.string(),
    operator: z.enum(["gt", "lt", "gte", "lte", "eq"]),
    value: z.number(),
    windowMinutes: z.number().int().default(5),
    endpointFilter: z.string().optional(),
  }),
  severity: z.enum(["critical", "high", "medium", "low"]),
  channels: z.array(z.object({
    type: z.enum(["slack", "email", "pagerduty", "webhook"]),
    config: z.record(z.string()),
  })).default([]),
});

export async function alertsRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  // List alert rules for project
  app.get("/v1/alerts/rules", async (
    req: FastifyRequest<{ Querystring: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const rules = await prisma.alertRule.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ data: rules });
  });

  // Create alert rule
  app.post("/v1/alerts/rules", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateAlertRuleSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });

    const rule = await prisma.alertRule.create({
      data: {
        id: generateId(),
        ...parsed.data,
        condition: parsed.data.condition as object,
        channels: parsed.data.channels as object[],
      },
    });

    return reply.status(201).send({ data: rule });
  });

  // Update rule (toggle enable/disable)
  app.patch("/v1/alerts/rules/:ruleId", async (
    req: FastifyRequest<{ Params: { ruleId: string }; Body: { enabled?: boolean } }>,
    reply: FastifyReply
  ) => {
    const rule = await prisma.alertRule.update({
      where: { id: req.params.ruleId },
      data: { enabled: req.body.enabled },
    });
    return reply.send({ data: rule });
  });

  // Delete rule
  app.delete("/v1/alerts/rules/:ruleId", async (
    req: FastifyRequest<{ Params: { ruleId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.alertRule.delete({ where: { id: req.params.ruleId } });
    return reply.status(204).send();
  });

  // Get alert event history
  app.get("/v1/alerts/events", async (
    req: FastifyRequest<{ Querystring: { projectId: string; limit?: string; resolved?: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId, limit = "50", resolved } = req.query;
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const events = await prisma.alertEvent.findMany({
      where: {
        projectId,
        ...(resolved === "true" ? { resolvedAt: { not: null } } : {}),
        ...(resolved === "false" ? { resolvedAt: null } : {}),
      },
      include: { rule: { select: { name: true, type: true, severity: true } } },
      orderBy: { triggeredAt: "desc" },
      take: Math.min(Number(limit), 200),
    });

    return reply.send({ data: events });
  });

  // Resolve an alert event
  app.post("/v1/alerts/events/:eventId/resolve", async (
    req: FastifyRequest<{ Params: { eventId: string } }>,
    reply: FastifyReply
  ) => {
    const event = await prisma.alertEvent.update({
      where: { id: req.params.eventId },
      data: { resolvedAt: new Date() },
    });
    return reply.send({ data: event });
  });

  // Manual trigger: evaluate all rules for a project now
  app.post("/v1/alerts/evaluate", async (
    req: FastifyRequest<{ Body: { projectId: string } }>,
    reply: FastifyReply
  ) => {
    const { projectId } = req.body;

    const rules = await prisma.alertRule.findMany({
      where: { projectId, enabled: true },
    });

    const triggered: string[] = [];

    for (const rule of rules) {
      const condition = rule.condition as {
        metric: string; operator: string; value: number; windowMinutes: number; endpointFilter?: string;
      };

      const since = new Date(Date.now() - condition.windowMinutes * 60 * 1000);

      let currentValue: number | null = null;

      if (condition.metric === "error_rate") {
        const whereClause = {
          projectId,
          timestamp: { gte: since },
          ...(condition.endpointFilter ? { path: condition.endpointFilter } : {}),
        };
        const [total, errors] = await Promise.all([
          prisma.apiTrace.count({ where: whereClause }),
          prisma.apiTrace.count({ where: { ...whereClause, statusCode: { gte: 400 } } }),
        ]);
        currentValue = total > 0 ? (errors / total) * 100 : 0;
      } else if (condition.metric === "health_score") {
        const endpoints = await prisma.apiEndpoint.findMany({
          where: { projectId },
          select: { healthScore: true },
        });
        currentValue = endpoints.length > 0
          ? endpoints.reduce((s: number, e: any) => s + e.healthScore, 0) / endpoints.length
          : 100;
      }

      if (currentValue === null) continue;

      const breached =
        (condition.operator === "gt" && currentValue > condition.value) ||
        (condition.operator === "gte" && currentValue >= condition.value) ||
        (condition.operator === "lt" && currentValue < condition.value) ||
        (condition.operator === "lte" && currentValue <= condition.value) ||
        (condition.operator === "eq" && currentValue === condition.value);

      if (breached) {
        await prisma.alertEvent.create({
          data: {
            id: generateId(),
            projectId,
            ruleId: rule.id,
            message: `Alert: ${rule.name} — ${condition.metric} is ${currentValue.toFixed(2)} (threshold: ${condition.operator} ${condition.value})`,
            severity: rule.severity,
            metadata: { currentValue, threshold: condition.value, metric: condition.metric },
          },
        });
        triggered.push(rule.name);
      }
    }

    return reply.send({ evaluated: rules.length, triggered, triggeredRules: triggered });
  });
}
