// ============================================================
// KYNTRA — Shared Types
// Single source of truth for all data models across services
// ============================================================

// ── Primitives ───────────────────────────────────────────────

export type ID = string;
export type Timestamp = string; // ISO 8601

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type Environment = "production" | "staging" | "development" | "test";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

// ── Project ──────────────────────────────────────────────────

export interface Project {
  id: ID;
  name: string;
  slug: string;
  apiKey: string;
  githubRepoUrl?: string;
  githubInstallationId?: string;
  settings: ProjectSettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProjectSettings {
  enableAiReviews: boolean;
  enableTestGeneration: boolean;
  enableAnomalyDetection: boolean;
  dataRetentionDays: number;
  alertThresholds: {
    errorRatePercent: number;
    latencyP99Ms: number;
    healthScoreMin: number;
  };
  maskedFields: string[]; // Field names to redact from payloads
}

// ── API Tracing ──────────────────────────────────────────────

export interface ApiTrace {
  id: ID;
  projectId: ID;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  method: HttpMethod;
  url: string;
  path: string; // Normalized: /users/:id
  statusCode: number;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  durationMs: number;
  environment: Environment;
  serviceId: string;
  tags: string[];
  timestamp: Timestamp;
}

export type ApiTraceInput = Omit<ApiTrace, "id" | "path"> & {
  path?: string;
};

export interface ApiEndpoint {
  id: ID;
  projectId: ID;
  method: HttpMethod;
  path: string;
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  totalCalls: number;
  successRate: number; // 0.0–1.0
  errorRate: number; // 0.0–1.0
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  openApiSpec?: OpenApiSchema;
  healthScore: number; // 0–100
  healthStatus: HealthStatus;
  trend: "improving" | "degrading" | "stable";
}

export interface OpenApiSchema {
  parameters?: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: Record<string, unknown> }>;
  };
  responses: Record<string, {
    description: string;
    content?: Record<string, { schema: Record<string, unknown> }>;
  }>;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  schema: Record<string, unknown>;
  example?: unknown;
}

// ── UI Events ────────────────────────────────────────────────

export type UiEventType =
  | "click"
  | "navigation"
  | "api_call"
  | "error"
  | "performance"
  | "form_submit"
  | "page_load"
  | "custom";

export interface UiEvent {
  id: ID;
  projectId: ID;
  sessionId: string;
  userId?: string;
  type: UiEventType;
  element?: string; // CSS selector
  url: string;
  referrer?: string;
  metadata: Record<string, unknown>;
  timestamp: Timestamp;
  durationMs?: number;
}

export type UiEventInput = Omit<UiEvent, "id">;

export interface WebVitals {
  lcp?: number; // Largest Contentful Paint (ms)
  fid?: number; // First Input Delay (ms)
  cls?: number; // Cumulative Layout Shift (score)
  fcp?: number; // First Contentful Paint (ms)
  ttfb?: number; // Time to First Byte (ms)
  inp?: number; // Interaction to Next Paint (ms)
}

// ── Analysis ─────────────────────────────────────────────────

export type AnalysisType =
  | "api_health"
  | "anomaly_detection"
  | "root_cause"
  | "code_review"
  | "test_generation"
  | "dependency_graph"
  | "performance_report";

export type AnalysisStatus = "pending" | "running" | "complete" | "failed";

export interface AnalysisResult {
  id: ID;
  projectId: ID;
  type: AnalysisType;
  status: AnalysisStatus;
  input: Record<string, unknown>;
  output: AnalysisOutput | null;
  summary: string;
  severity?: Severity;
  relatedEntityId?: ID;
  errorMessage?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export type AnalysisOutput =
  | ApiHealthOutput
  | AnomalyOutput
  | RootCauseOutput
  | CodeReviewOutput
  | TestGenerationOutput
  | DependencyGraphOutput;

export interface ApiHealthOutput {
  type: "api_health";
  healthScore: number;
  healthStatus: HealthStatus;
  metrics: {
    errorRate: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    totalCalls: number;
  };
  issues: ApiHealthIssue[];
  recommendations: string[];
}

export interface ApiHealthIssue {
  severity: Severity;
  category: "latency" | "error_rate" | "availability" | "schema_drift";
  message: string;
  affectedEndpoint?: string;
  detectedAt: Timestamp;
}

export interface AnomalyOutput {
  type: "anomaly_detection";
  anomalies: Anomaly[];
  summary: string;
}

export interface Anomaly {
  id: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  metric: "latency" | "error_rate" | "throughput";
  severity: Severity;
  expectedValue: number;
  observedValue: number;
  affectedEndpoints: string[];
  probableCause: string;
}

export interface RootCauseOutput {
  type: "root_cause";
  rootCause: string;
  causalChain: CausalStep[];
  affectedServices: string[];
  recommendation: string;
  confidence: number; // 0.0–1.0
}

export interface CausalStep {
  order: number;
  service: string;
  description: string;
  evidence: string[];
  timestamp: Timestamp;
}

export interface CodeReviewOutput {
  type: "code_review";
  riskScore: number; // 0–100
  summary: string;
  comments: ReviewComment[];
  positives: string[];
  suggestedTests: string[];
}

export interface ReviewComment {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  severity: Severity;
  category: ReviewCategory;
  message: string;
  suggestion?: string;
  autoFixable: boolean;
}

export type ReviewCategory =
  | "security"
  | "performance"
  | "bug"
  | "maintainability"
  | "test_coverage"
  | "api_contract";

export interface TestGenerationOutput {
  type: "test_generation";
  framework: "jest" | "vitest" | "playwright" | "cypress";
  language: "typescript" | "javascript";
  testFile: GeneratedTestFile;
  coverage: {
    endpoints: string[];
    scenarios: string[];
  };
}

export interface GeneratedTestFile {
  filename: string;
  content: string;
  testCount: number;
  imports: string[];
}

export interface DependencyGraphOutput {
  type: "dependency_graph";
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  criticalPaths: string[][];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: "service" | "database" | "external_api" | "queue";
  healthScore: number;
  requestRate: number;
  errorRate: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  callsPerMinute: number;
  avgLatencyMs: number;
  errorRate: number;
}

// ── Code Review ──────────────────────────────────────────────

export interface CodeReview {
  id: ID;
  projectId: ID;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  prAuthor: string;
  baseBranch: string;
  headBranch: string;
  diffSummary: string;
  riskScore: number;
  status: ReviewStatus;
  analysisId?: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ReviewStatus = "pending" | "analyzing" | "complete" | "dismissed" | "failed";

// ── Test Cases ────────────────────────────────────────────────

export interface TestCase {
  id: ID;
  projectId: ID;
  endpointId?: ID;
  name: string;
  description: string;
  type: TestType;
  framework: string;
  code: string;
  status: TestStatus;
  lastRunAt?: Timestamp;
  lastRunDurationMs?: number;
  createdAt: Timestamp;
  sourceTraceId?: ID;
  sourceAnalysisId?: ID;
}

export type TestType = "unit" | "integration" | "e2e" | "contract" | "performance";
export type TestStatus = "pending" | "passed" | "failed" | "skipped" | "running";

// ── Alerts ───────────────────────────────────────────────────

export interface AlertRule {
  id: ID;
  projectId: ID;
  name: string;
  description: string;
  type: AlertType;
  condition: AlertCondition;
  severity: Severity;
  enabled: boolean;
  channels: AlertChannel[];
  createdAt: Timestamp;
}

export type AlertType = "threshold" | "anomaly" | "health_score" | "error_spike";

export interface AlertCondition {
  metric: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq";
  value: number;
  windowMinutes: number;
  endpointFilter?: string;
}

export interface AlertChannel {
  type: "slack" | "email" | "pagerduty" | "webhook";
  config: Record<string, string>;
}

export interface AlertEvent {
  id: ID;
  ruleId: ID;
  projectId: ID;
  triggeredAt: Timestamp;
  resolvedAt?: Timestamp;
  message: string;
  severity: Severity;
  metadata: Record<string, unknown>;
}

// ── Reports ──────────────────────────────────────────────────

export interface Report {
  id: ID;
  projectId: ID;
  type: ReportType;
  title: string;
  period: { start: Timestamp; end: Timestamp };
  sections: ReportSection[];
  createdAt: Timestamp;
}

export type ReportType = "weekly" | "incident" | "deployment" | "custom";

export interface ReportSection {
  title: string;
  content: string; // Markdown
  data?: Record<string, unknown>;
  charts?: ChartSpec[];
}

export interface ChartSpec {
  type: "line" | "bar" | "pie" | "heatmap";
  title: string;
  data: unknown[];
}

// ── API Response Wrappers ────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    cursor?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Ingestion Batches ────────────────────────────────────────

export interface TraceBatch {
  projectId: ID;
  apiKey: string;
  traces: ApiTraceInput[];
  sentAt: Timestamp;
  sdkVersion: string;
}

export interface EventBatch {
  projectId: ID;
  apiKey: string;
  events: UiEventInput[];
  sentAt: Timestamp;
  sdkVersion: string;
}

export interface BatchAck {
  accepted: number;
  rejected: number;
  batchId: string;
  errors?: string[];
}

// ── GitHub Webhook Payloads ───────────────────────────────────

export interface GithubPullRequestPayload {
  action: "opened" | "synchronize" | "closed" | "reopened";
  number: number;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    head: { ref: string; sha: string };
    base: { ref: string };
    diff_url: string;
    patch_url: string;
    body?: string;
    changed_files: number;
    additions: number;
    deletions: number;
  };
  repository: {
    full_name: string;
    html_url: string;
    clone_url: string;
  };
  installation?: { id: number };
}
