/**
 * MCP tools for querying API intelligence data from Kyntra.
 */

const GATEWAY_URL = process.env["KYNTRA_GATEWAY_URL"] ?? "http://localhost:3000";
const API_KEY = process.env["KYNTRA_API_KEY"] ?? "";

async function gatewayFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Gateway returned ${res.status} for ${path}`);
  return res.json();
}

async function gatewayPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gateway returned ${res.status} for POST ${path}`);
  return res.json();
}

export const apiTools = {
  // List API endpoints
  list_api_endpoints: async ({ projectId, limit = 20 }: { projectId: string; limit?: number }) => {
    const data = await gatewayFetch(`/v1/apis?projectId=${projectId}`) as {
      data: {
        endpoints: Array<{ method: string; path: string; healthScore: number; errorRate: number; p99LatencyMs: number; totalCalls: number }>;
        summary: { total: number; healthy: number; degraded: number; down: number };
      };
    };
    const endpoints = data.data.endpoints.slice(0, limit);
    return {
      summary: data.data.summary,
      endpoints: endpoints.map((e) => ({
        endpoint: `${e.method} ${e.path}`,
        healthScore: e.healthScore,
        errorRate: `${(e.errorRate * 100).toFixed(2)}%`,
        p99Latency: `${e.p99LatencyMs}ms`,
        totalCalls: e.totalCalls,
      })),
    };
  },

  // Get SLA status
  get_sla_status: async ({ projectId }: { projectId: string }) => {
    const data = await gatewayFetch(`/v1/sla/current?projectId=${projectId}`) as { data: unknown };
    return data.data;
  },

  // Get recent traces
  get_recent_traces: async ({ projectId, path, limit = 10 }: { projectId: string; path?: string; limit?: number }) => {
    const params = new URLSearchParams({ projectId, limit: String(limit) });
    if (path) params.set("path", path);
    const data = await gatewayFetch(`/v1/traces?${params}`) as {
      data: { traces: Array<{ method: string; path: string; statusCode: number; durationMs: number; timestamp: string }> };
    };
    return data.data.traces.map((t) => ({
      endpoint: `${t.method} ${t.path}`,
      status: t.statusCode,
      latency: `${t.durationMs}ms`,
      time: new Date(t.timestamp).toLocaleString(),
    }));
  },

  // Trigger AI health analysis
  run_health_analysis: async ({ projectId, endpointId }: { projectId: string; endpointId: string }) => {
    const result = await gatewayPost("/v1/analyze", {
      type: "api_health",
      projectId,
      options: { endpointId, windowMinutes: 60 },
    }) as { analysisId: string };

    return { analysisId: result.analysisId, message: "Health analysis queued. Poll /v1/analyze/:id for results." };
  },

  // Get code reviews
  list_code_reviews: async ({ projectId, limit = 5 }: { projectId: string; limit?: number }) => {
    const data = await gatewayFetch(`/v1/reviews?projectId=${projectId}&limit=${limit}`) as {
      data: Array<{ prNumber: number; prTitle: string; riskScore: number; status: string; prAuthor: string }>;
    };
    return data.data.map((r) => ({
      pr: `#${r.prNumber} ${r.prTitle}`,
      riskScore: r.riskScore,
      status: r.status,
      author: r.prAuthor,
    }));
  },

  // Get alert events
  get_alert_events: async ({ projectId, limit = 10 }: { projectId: string; limit?: number }) => {
    const data = await gatewayFetch(`/v1/alerts/events?projectId=${projectId}&limit=${limit}&resolved=false`) as {
      data: Array<{ message: string; severity: string; triggeredAt: string; rule: { name: string } }>;
    };
    return data.data.map((e) => ({
      rule: e.rule.name,
      message: e.message,
      severity: e.severity,
      triggeredAt: new Date(e.triggeredAt).toLocaleString(),
    }));
  },

  // Generate OpenAPI spec
  export_openapi: async ({ projectId }: { projectId: string }) => {
    const data = await gatewayFetch(`/v1/openapi?projectId=${projectId}`) as {
      paths: Record<string, unknown>;
      info: { title: string; version: string };
    };
    const pathCount = Object.keys(data.paths).length;
    return {
      title: data.info.title,
      version: data.info.version,
      endpointCount: pathCount,
      message: `OpenAPI spec generated with ${pathCount} paths. Use GET /v1/openapi?projectId=${projectId}&format=yaml to download.`,
    };
  },

  // Generate tests for an endpoint
  generate_tests: async ({ projectId, endpointId, framework = "vitest" }: { projectId: string; endpointId: string; framework?: string }) => {
    const result = await gatewayPost("/v1/tests/generate", { projectId, endpointId, framework }) as { analysisId: string };
    return { analysisId: result.analysisId, message: `Test generation queued for framework: ${framework}` };
  },
};

export type ApiToolName = keyof typeof apiTools;
