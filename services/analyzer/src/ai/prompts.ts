export const SYSTEM_PROMPTS = {
  API_HEALTH: `You are Kyntra's API health analyzer. You analyze API trace data and produce structured health assessments.
Always respond with valid JSON matching the ApiHealthOutput type.
Be precise, data-driven, and actionable. Focus on patterns that affect user experience.`,

  ANOMALY_DETECTION: `You are Kyntra's anomaly detection engine. You identify statistical anomalies in API metrics.
Always respond with valid JSON. Distinguish between transient spikes and sustained degradation.
Provide specific timestamps and affected endpoints.`,

  ROOT_CAUSE: `You are Kyntra's root cause analysis engine. You correlate error signals across services to find the true root cause.
Always respond with valid JSON. Build a causal chain from symptom to root cause.
Be specific about which service or code path caused the issue.`,

  CODE_REVIEW: `You are Kyntra's AI code reviewer. You review pull request diffs and provide structured, actionable feedback.
Always respond with valid JSON. Categories: security, performance, bug, maintainability, test_coverage, api_contract.
Severities: critical, high, medium, low, info.
Be specific: cite line numbers, explain why the issue matters, provide a concrete suggestion.
Do not flag style issues as critical. Reserve critical for security vulnerabilities and data loss bugs.`,

  TEST_GENERATION: `You are Kyntra's test generation engine. You create comprehensive, runnable test suites from API traces and schemas.
Always respond with valid JSON containing a complete test file as a string.
Generate tests using the specified framework. Include: happy path, error cases, edge cases, and boundary conditions.
Tests must be self-contained and not rely on external state.`,
};

export function buildApiHealthPrompt(data: {
  endpoint: string;
  method: string;
  traces: Array<{ statusCode: number; durationMs: number; timestamp: string; error?: string }>;
  windowMinutes: number;
}): string {
  return `Analyze the health of this API endpoint:

Endpoint: ${data.method} ${data.endpoint}
Time window: last ${data.windowMinutes} minutes
Sample count: ${data.traces.length}

Trace data (statusCode, durationMs, timestamp):
${JSON.stringify(data.traces.slice(0, 100), null, 2)}

Return a JSON object with this exact structure:
{
  "type": "api_health",
  "healthScore": <0-100>,
  "healthStatus": <"healthy"|"degraded"|"down">,
  "metrics": {
    "errorRate": <0.0-1.0>,
    "p50Ms": <number>,
    "p95Ms": <number>,
    "p99Ms": <number>,
    "totalCalls": <number>
  },
  "issues": [
    {
      "severity": <"critical"|"high"|"medium"|"low">,
      "category": <"latency"|"error_rate"|"availability"|"schema_drift">,
      "message": <string>,
      "detectedAt": <ISO timestamp>
    }
  ],
  "recommendations": [<string>]
}`;
}

export function buildAnomalyPrompt(data: {
  endpoint: string;
  timeSeriesData: Array<{ timestamp: string; avgLatencyMs: number; errorRate: number; requestCount: number }>;
}): string {
  return `Detect anomalies in this API time series data:

Endpoint: ${data.endpoint}
Data points (5-minute buckets):
${JSON.stringify(data.timeSeriesData, null, 2)}

Return a JSON object:
{
  "type": "anomaly_detection",
  "anomalies": [
    {
      "id": <string>,
      "startTime": <ISO timestamp>,
      "endTime": <ISO timestamp or null>,
      "metric": <"latency"|"error_rate"|"throughput">,
      "severity": <"critical"|"high"|"medium"|"low">,
      "expectedValue": <number>,
      "observedValue": <number>,
      "affectedEndpoints": [<string>],
      "probableCause": <string>
    }
  ],
  "summary": <string>
}`;
}

export function buildCodeReviewPrompt(data: {
  prTitle: string;
  prDescription?: string;
  diff: string;
  language: string;
  framework?: string;
}): string {
  return `Review this pull request:

Title: ${data.prTitle}
${data.prDescription ? `Description: ${data.prDescription}` : ""}
Language: ${data.language}
${data.framework ? `Framework: ${data.framework}` : ""}

Diff:
\`\`\`diff
${data.diff.slice(0, 12000)}
\`\`\`

Return a JSON object:
{
  "type": "code_review",
  "riskScore": <0-100>,
  "summary": <string>,
  "comments": [
    {
      "filePath": <string>,
      "lineStart": <number>,
      "lineEnd": <number>,
      "severity": <"critical"|"high"|"medium"|"low"|"info">,
      "category": <"security"|"performance"|"bug"|"maintainability"|"test_coverage"|"api_contract">,
      "message": <string>,
      "suggestion": <string or null>,
      "autoFixable": <boolean>
    }
  ],
  "positives": [<string>],
  "suggestedTests": [<string>]
}`;
}

export function buildTestGenerationPrompt(data: {
  endpoint: string;
  method: string;
  baseUrl: string;
  sampleTraces: Array<{
    requestBody?: unknown;
    responseBody?: unknown;
    statusCode: number;
    queryParams?: Record<string, string>;
  }>;
  framework: "jest" | "vitest";
}): string {
  return `Generate a comprehensive test suite for this API endpoint:

Endpoint: ${data.method} ${data.endpoint}
Base URL: ${data.baseUrl}
Framework: ${data.framework}

Sample traces (request/response pairs):
${JSON.stringify(data.sampleTraces.slice(0, 5), null, 2)}

Return a JSON object:
{
  "type": "test_generation",
  "framework": "${data.framework}",
  "language": "typescript",
  "testFile": {
    "filename": <string>,
    "content": <complete test file as string>,
    "testCount": <number>,
    "imports": [<string>]
  },
  "coverage": {
    "endpoints": [<string>],
    "scenarios": [<string>]
  }
}

The test file must be complete and runnable. Use axios or fetch for HTTP calls. Include beforeAll/afterAll if needed.`;
}
