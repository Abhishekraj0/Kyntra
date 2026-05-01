/**
 * AI-powered frontend session analysis.
 * Uses Claude to analyze correlated UI+API sessions.
 */

import { getAIClient, CLAUDE_MODEL, MAX_TOKENS } from "../ai/client.js";
import type { CorrelatedSession } from "@kyntra/playwright-agent";

const SYSTEM_PROMPT = `You are Kyntra's frontend intelligence analyzer. You analyze correlated frontend user sessions with their backend API calls to identify UX issues, performance bottlenecks, and conversion problems.

Always respond with valid JSON. Be specific about which user actions cause API problems.`;

export interface FrontendAnalysisOutput {
  type: "frontend_analysis";
  sessionQuality: "good" | "degraded" | "broken";
  qualityScore: number; // 0-100
  uxIssues: UxIssue[];
  performanceBottlenecks: PerformanceBottleneck[];
  conversionInsights: string[];
  recommendations: string[];
  summary: string;
}

export interface UxIssue {
  severity: "critical" | "high" | "medium" | "low";
  category: "navigation" | "api_latency" | "error_loop" | "dead_click" | "form_abandonment";
  description: string;
  affectedElement?: string;
  timestamp: string;
}

export interface PerformanceBottleneck {
  type: "slow_api" | "render_blocking" | "excessive_calls" | "large_payload";
  description: string;
  endpoint?: string;
  latencyMs?: number;
  impact: "high" | "medium" | "low";
}

export async function analyzeFrontendSession(
  session: CorrelatedSession
): Promise<FrontendAnalysisOutput> {
  const client = getAIClient();

  const sessionSummary = {
    sessionId: session.sessionId,
    durationMs: session.performanceMetrics.totalSessionDurationMs,
    pageViews: session.pageViews,
    funnelSteps: session.funnelSteps.map((s) => ({
      step: s.step,
      page: s.name,
      durationMs: s.durationMs,
      apiCalls: s.apiCallCount,
      errors: s.errorCount,
    })),
    topApiCalls: session.apiCalls.slice(0, 20).map((c) => ({
      endpoint: `${c.method} ${c.path}`,
      status: c.statusCode,
      latencyMs: c.durationMs,
      triggeredBy: c.triggeredByElement,
    })),
    errors: session.errors.slice(0, 10),
    metrics: session.performanceMetrics,
  };

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this user session and identify UX and performance issues:

${JSON.stringify(sessionSummary, null, 2)}

Return JSON:
{
  "type": "frontend_analysis",
  "sessionQuality": <"good"|"degraded"|"broken">,
  "qualityScore": <0-100>,
  "uxIssues": [
    {
      "severity": <"critical"|"high"|"medium"|"low">,
      "category": <"navigation"|"api_latency"|"error_loop"|"dead_click"|"form_abandonment">,
      "description": <string>,
      "affectedElement": <string or null>,
      "timestamp": <string>
    }
  ],
  "performanceBottlenecks": [
    {
      "type": <"slow_api"|"render_blocking"|"excessive_calls"|"large_payload">,
      "description": <string>,
      "endpoint": <string or null>,
      "latencyMs": <number or null>,
      "impact": <"high"|"medium"|"low">
    }
  ],
  "conversionInsights": [<string>],
  "recommendations": [<string>],
  "summary": <string>
}`,
      },
    ],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") throw new Error("Bad AI response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  return JSON.parse(jsonMatch[0]) as FrontendAnalysisOutput;
}
