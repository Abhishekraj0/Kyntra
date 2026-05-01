import { PrismaClient } from "@prisma/client";
import { getAIClient, CLAUDE_MODEL, MAX_TOKENS } from "../ai/client.js";
import { SYSTEM_PROMPTS, buildAnomalyPrompt } from "../ai/prompts.js";
import type { AnomalyOutput } from "@kyntra/shared";

export async function detectAnomalies(
  prisma: PrismaClient,
  projectId: string,
  endpointPath?: string,
  windowMinutes = 120
): Promise<AnomalyOutput> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const bucketMs = 5 * 60 * 1000; // 5-minute buckets

  const whereClause = {
    projectId,
    timestamp: { gte: since },
    ...(endpointPath ? { path: endpointPath } : {}),
  };

  const traces = await prisma.apiTrace.findMany({
    where: whereClause,
    select: { path: true, durationMs: true, statusCode: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  if (traces.length < 20) {
    return {
      type: "anomaly_detection",
      anomalies: [],
      summary: "Insufficient data for anomaly detection (need at least 20 data points).",
    };
  }

  // Group into 5-minute time buckets
  const buckets = new Map<number, { latencies: number[]; errors: number; total: number; path: string }>();
  for (const trace of traces) {
    const bucket = Math.floor(trace.timestamp.getTime() / bucketMs) * bucketMs;
    const b = buckets.get(bucket) ?? { latencies: [] as number[], errors: 0, total: 0, path: trace.path };
    b.latencies.push(trace.durationMs);
    b.total++;
    if (trace.statusCode >= 400) b.errors++;
    buckets.set(bucket, b);
  }

  const timeSeries = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, b]) => ({
      timestamp: new Date(ts).toISOString(),
      avgLatencyMs: Math.round(b.latencies.reduce((s, v) => s + v, 0) / b.latencies.length),
      errorRate: parseFloat((b.errors / b.total).toFixed(4)),
      requestCount: b.total,
    }));

  const endpoint = endpointPath ?? "all endpoints";
  const client = getAIClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPTS.ANOMALY_DETECTION,
    messages: [
      {
        role: "user",
        content: buildAnomalyPrompt({ endpoint, timeSeriesData: timeSeries }),
      },
    ],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") {
    throw new Error("Unexpected AI response format");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  return JSON.parse(jsonMatch[0]) as AnomalyOutput;
}
