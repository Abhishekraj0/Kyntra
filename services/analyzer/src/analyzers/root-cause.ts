import { PrismaClient } from "@prisma/client";
import { getAIClient, CLAUDE_MODEL, MAX_TOKENS } from "../ai/client.js";
import type { RootCauseOutput } from "@kyntra/shared";

const SYSTEM_PROMPT = `You are Kyntra's root cause analysis engine. Analyze correlated error signals across API services and identify the true root cause.

Always respond with valid JSON. Build a precise causal chain from symptom to root cause.
Identify which service or code path initiated the failure cascade.`;

export async function analyzeRootCause(
  prisma: PrismaClient,
  projectId: string,
  errorCluster: { startTime: string; endTime: string; affectedPaths?: string[] }
): Promise<RootCauseOutput> {
  const start = new Date(errorCluster.startTime);
  const end = new Date(errorCluster.endTime);

  const traces = await prisma.apiTrace.findMany({
    where: {
      projectId,
      timestamp: { gte: start, lte: end },
      statusCode: { gte: 400 },
      ...(errorCluster.affectedPaths?.length
        ? { path: { in: errorCluster.affectedPaths } }
        : {}),
    },
    select: {
      path: true, method: true, statusCode: true, durationMs: true,
      timestamp: true, serviceId: true, traceId: true,
      responseBody: true,
    },
    orderBy: { timestamp: "asc" },
    take: 100,
  });

  if (traces.length === 0) {
    return {
      type: "root_cause",
      rootCause: "No error traces found in the specified time window.",
      causalChain: [],
      affectedServices: [],
      recommendation: "Expand the time window or check if errors occurred in this period.",
      confidence: 0,
    };
  }

  // Group by service and path
  const serviceErrors = new Map<string, number>();
  const pathErrors = new Map<string, { count: number; codes: number[]; firstSeen: string }>();

  for (const trace of traces) {
    serviceErrors.set(trace.serviceId, (serviceErrors.get(trace.serviceId) ?? 0) + 1);
    const pe = pathErrors.get(trace.path) ?? { count: 0, codes: [] as number[], firstSeen: trace.timestamp.toISOString() };
    pe.count++;
    pe.codes.push(trace.statusCode);
    pathErrors.set(trace.path, pe);
  }

  const errorSummary = {
    totalErrors: traces.length,
    timeWindow: { start: errorCluster.startTime, end: errorCluster.endTime },
    affectedServices: Array.from(serviceErrors.entries()).map(([s, count]) => ({ service: s, errorCount: count })),
    affectedEndpoints: Array.from(pathErrors.entries()).map(([path, d]) => ({
      path,
      errorCount: d.count,
      firstErrorAt: d.firstSeen,
      statusCodes: [...new Set(d.codes)],
    })),
    errorSamples: traces.slice(0, 10).map((t: any) => ({
      path: t.path,
      method: t.method,
      statusCode: t.statusCode,
      durationMs: t.durationMs,
      timestamp: t.timestamp.toISOString(),
      serviceId: t.serviceId,
    })),
  };

  const client = getAIClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this error cluster and identify the root cause:

${JSON.stringify(errorSummary, null, 2)}

Return JSON:
{
  "type": "root_cause",
  "rootCause": <string — one sentence>,
  "causalChain": [
    {
      "order": <number>,
      "service": <string>,
      "description": <string>,
      "evidence": [<string>],
      "timestamp": <ISO string>
    }
  ],
  "affectedServices": [<string>],
  "recommendation": <string — actionable fix>,
  "confidence": <0.0-1.0>
}`,
      },
    ],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") throw new Error("Bad AI response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  return JSON.parse(jsonMatch[0]) as RootCauseOutput;
}
