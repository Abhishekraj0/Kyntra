import { PrismaClient } from "@prisma/client";
import { getAIClient, CLAUDE_MODEL, MAX_TOKENS } from "../ai/client.js";
import { SYSTEM_PROMPTS, buildApiHealthPrompt } from "../ai/prompts.js";
import type { ApiHealthOutput } from "@kyntra/shared";

export async function analyzeApiHealth(
  prisma: PrismaClient,
  projectId: string,
  endpointId: string,
  windowMinutes = 60
): Promise<ApiHealthOutput> {
  // Fetch endpoint info
  const endpoint = await prisma.apiEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) {
    throw new Error(`Endpoint ${endpointId} not found`);
  }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  // Fetch recent traces
  const traces = await prisma.apiTrace.findMany({
    where: {
      projectId,
      path: endpoint.path,
      method: endpoint.method,
      timestamp: { gte: since },
    },
    select: {
      statusCode: true,
      durationMs: true,
      timestamp: true,
      responseBody: true,
    },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  if (traces.length === 0) {
    return {
      type: "api_health",
      healthScore: 100,
      healthStatus: "healthy",
      metrics: { errorRate: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, totalCalls: 0 },
      issues: [],
      recommendations: ["No recent traffic. Add monitoring to track this endpoint."],
    };
  }

  const traceData = traces.map((t: any) => ({
    statusCode: t.statusCode,
    durationMs: t.durationMs,
    timestamp: t.timestamp.toISOString(),
  }));

  const client = getAIClient();

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPTS.API_HEALTH,
    messages: [
      {
        role: "user",
        content: buildApiHealthPrompt({
          endpoint: endpoint.path,
          method: endpoint.method,
          traces: traceData,
          windowMinutes,
        }),
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

  return JSON.parse(jsonMatch[0]) as ApiHealthOutput;
}
