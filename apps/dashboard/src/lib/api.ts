const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error((error as { message?: string }).message ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Typed API helpers
export async function getProjects() {
  return api.get<{ data: Project[] }>("/v1/projects");
}

export async function getProject(id: string) {
  return api.get<{ data: Project }>(`/v1/projects/${id}`);
}

export async function getApis(projectId: string) {
  return api.get<{ data: { endpoints: Endpoint[]; summary: ApiSummary } }>(
    `/v1/apis?projectId=${projectId}`
  );
}

export async function getTraces(projectId: string, path?: string, method?: string) {
  const params = new URLSearchParams({ projectId });
  if (path) params.set("path", path);
  if (method) params.set("method", method);
  return api.get<{ data: { traces: Trace[]; hasMore: boolean } }>(`/v1/traces?${params}`);
}

export async function getReviews(projectId: string) {
  return api.get<{ data: Review[] }>(`/v1/reviews?projectId=${projectId}`);
}

export async function getTests(projectId: string) {
  return api.get<{ data: TestCase[] }>(`/v1/tests?projectId=${projectId}`);
}

export async function getReports(projectId: string) {
  return api.get<{ data: Report[] }>(`/v1/reports?projectId=${projectId}`);
}

export async function generateReport(projectId: string) {
  return api.post<{ data: Report }>("/v1/reports/generate", { projectId });
}

export async function getSlaStatus(projectId: string) {
  return api.get<{ data: SlaStatus }>(`/v1/sla/current?projectId=${projectId}`);
}

export async function computeSla(projectId: string) {
  return api.post<{ data: SlaRecord[] }>("/v1/sla/compute", { projectId });
}

export async function getAlertEvents(projectId: string, resolved?: boolean) {
  const params = new URLSearchParams({ projectId });
  if (resolved !== undefined) params.set("resolved", String(resolved));
  return api.get<{ data: AlertEvent[] }>(`/v1/alerts/events?${params}`);
}

export async function getAlertRules(projectId: string) {
  return api.get<{ data: AlertRule[] }>(`/v1/alerts/rules?projectId=${projectId}`);
}

export async function createAlertRule(body: {
  projectId: string;
  name: string;
  type: string;
  severity: string;
  condition: Record<string, unknown>;
  channels?: unknown[];
}) {
  return api.post<{ data: AlertRule }>("/v1/alerts/rules", body);
}

export async function resolveAlertEvent(eventId: string) {
  return api.post<{ data: AlertEvent }>(`/v1/alerts/events/${eventId}/resolve`, {});
}

export async function exportOpenApi(projectId: string, format: "json" | "yaml" = "json") {
  const params = new URLSearchParams({ projectId, format });
  return api.get<unknown>(`/v1/openapi?${params}`);
}

// Types (simplified client-side versions)
export interface Project {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  githubRepoUrl?: string;
  createdAt: string;
  _count?: { traces: number; codeReviews: number };
}

export interface Endpoint {
  id: string;
  method: string;
  path: string;
  totalCalls: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  healthScore: number;
  healthStatus: string;
  lastSeen: string;
}

export interface ApiSummary {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface Trace {
  id: string;
  method: string;
  path: string;
  url: string;
  statusCode: number;
  durationMs: number;
  environment: string;
  timestamp: string;
}

export interface Review {
  id: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  prAuthor: string;
  riskScore: number;
  status: string;
  createdAt: string;
}

export interface TestCase {
  id: string;
  name: string;
  type: string;
  framework: string;
  status: string;
  createdAt: string;
}

export interface Report {
  id: string;
  type: string;
  title: string;
  createdAt: string;
}

export interface SlaRecord {
  id: string;
  projectId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  uptimePercent: number;
  p99LatencyMs: number;
  errorRate: number;
  totalRequests: number;
  incidentCount: number;
  slaTarget: number;
  slaAchieved: boolean;
  createdAt: string;
}

export interface SlaStatus {
  uptime: number;
  slaTarget: number;
  slaAchieved: boolean;
  totalRequests24h: number;
  errorRate24h: number;
  totalEndpoints: number;
  healthyEndpoints: number;
  degradedEndpoints: number;
  downEndpoints: number;
  avgP99Ms: number;
  history: SlaRecord[];
}

export interface AlertRule {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: string;
  condition: Record<string, unknown>;
  severity: string;
  enabled: boolean;
  channels: unknown[];
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  projectId: string;
  ruleId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  message: string;
  severity: string;
  metadata: Record<string, unknown>;
  notified: boolean;
  rule?: { name: string };
}
