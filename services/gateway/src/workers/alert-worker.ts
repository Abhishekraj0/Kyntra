/**
 * Background worker that periodically evaluates alert rules
 * and dispatches notifications.
 */

import { PrismaClient } from "@prisma/client";
import { notifyAllChannels, type AlertChannel } from "../services/notifications.js";
import type { Severity } from "@kyntra/shared";

const EVAL_INTERVAL_MS = 60 * 1000; // Evaluate every 60 seconds

export function startAlertWorker(prisma: PrismaClient): ReturnType<typeof setInterval> {
  console.log("[AlertWorker] Started — evaluating rules every 60s");

  return setInterval(() => {
    void evaluateAllRules(prisma);
  }, EVAL_INTERVAL_MS);
}

async function evaluateAllRules(prisma: PrismaClient): Promise<void> {
  try {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, alertRules: { where: { enabled: true } } },
    });

    for (const project of projects) {
      for (const rule of project.alertRules) {
        await evaluateRule(prisma, project.id, project.name, rule);
      }
    }
  } catch (err) {
    console.error("[AlertWorker] Evaluation error:", err);
  }
}

async function evaluateRule(
  prisma: PrismaClient,
  projectId: string,
  projectName: string,
  rule: {
    id: string;
    name: string;
    condition: unknown;
    severity: string;
    channels: unknown;
  }
): Promise<void> {
  const condition = rule.condition as {
    metric: string;
    operator: string;
    value: number;
    windowMinutes: number;
    endpointFilter?: string;
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
  } else if (condition.metric === "p99_latency_ms") {
    const traces = await prisma.apiTrace.findMany({
      where: { projectId, timestamp: { gte: since } },
      select: { durationMs: true },
      orderBy: { durationMs: "desc" },
      take: Math.max(1, Math.ceil(await prisma.apiTrace.count({ where: { projectId, timestamp: { gte: since } } }) * 0.01)),
    });
    currentValue = traces[0]?.durationMs ?? 0;
  }

  if (currentValue === null) return;

  const breached =
    (condition.operator === "gt" && currentValue > condition.value) ||
    (condition.operator === "gte" && currentValue >= condition.value) ||
    (condition.operator === "lt" && currentValue < condition.value) ||
    (condition.operator === "lte" && currentValue <= condition.value);

  if (!breached) return;

  // Check if we already fired this rule recently (cooldown: 5 minutes)
  const recentFire = await prisma.alertEvent.findFirst({
    where: {
      ruleId: rule.id,
      triggeredAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });

  if (recentFire) return; // Cooldown active

  // Create alert event
  const message = `${rule.name}: ${condition.metric} is ${currentValue.toFixed(2)} (${condition.operator} ${condition.value})`;

  const event = await prisma.alertEvent.create({
    data: {
      id: `alert_${Date.now()}`,
      projectId,
      ruleId: rule.id,
      message,
      severity: rule.severity,
      metadata: { currentValue, threshold: condition.value, metric: condition.metric },
    },
  });

  // Send notifications
  const channels = rule.channels as AlertChannel[];
  if (channels.length > 0) {
    const results = await notifyAllChannels(channels, {
      ruleName: rule.name,
      message,
      severity: rule.severity as Severity,
      projectName,
      projectId,
      triggeredAt: event.triggeredAt.toISOString(),
      dashboardUrl: `${process.env["DASHBOARD_URL"] ?? "http://localhost:3003"}/overview?projectId=${projectId}`,
    });

    // Mark as notified
    const allNotified = results.every((r) => r.success);
    await prisma.alertEvent.update({
      where: { id: event.id },
      data: { notified: allNotified },
    });

    console.log(`[AlertWorker] Fired alert "${rule.name}" for project ${projectId}, notified: ${results.map((r) => r.channel).join(", ")}`);
  }
}
