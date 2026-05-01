// ============================================================
// KYNTRA — Shared Utilities
// ============================================================

import type { HttpMethod } from "../types/index.js";

// ── ID Generation ────────────────────────────────────────────

export function generateId(prefix = ""): string {
  const random = Math.random().toString(36).slice(2, 11);
  const ts = Date.now().toString(36);
  return prefix ? `${prefix}_${ts}${random}` : `${ts}${random}`;
}

export function generateTraceId(): string {
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  );
  return bytes.join("");
}

export function generateSpanId(): string {
  const bytes = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  );
  return bytes.join("");
}

// ── URL Normalization ────────────────────────────────────────

const PATH_PATTERNS = [
  // UUIDs
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  // Numeric IDs
  /\/\d+(?=\/|$)/g,
  // MongoDB ObjectIDs
  /[0-9a-f]{24}/gi,
  // Short hashes
  /[0-9a-f]{8,}/gi,
];

/**
 * Normalize a URL path by replacing dynamic segments with placeholders.
 * /users/123/posts/abc -> /users/:id/posts/:id
 */
export function normalizePath(url: string): string {
  try {
    const parsed = new URL(url, "http://example.com");
    let path = parsed.pathname;

    // Replace UUIDs
    path = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id"
    );
    // Replace numeric segments
    path = path.replace(/\/(\d+)(?=\/|$)/g, "/:id");
    // Replace 24-char hex (MongoDB ObjectID)
    path = path.replace(/\/([0-9a-f]{24})(?=\/|$)/gi, "/:id");

    return path;
  } catch {
    return url;
  }
}

// ── PII / Secret Sanitization ────────────────────────────────

const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "api-key",
  "authorization",
  "auth",
  "credit_card",
  "creditcard",
  "cvv",
  "ssn",
  "private_key",
  "privatekey",
  "access_token",
  "refresh_token",
]);

const REDACTED = "[REDACTED]";

/**
 * Recursively redact sensitive fields from an object.
 */
export function sanitizePayload(
  value: unknown,
  depth = 0
): unknown {
  if (depth > 10) return "[DEPTH_LIMIT]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncateString(value, 4096);
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizePayload(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = sanitizePayload(val, depth + 1);
    }
  }
  return result;
}

/**
 * Sanitize HTTP headers, removing auth headers.
 */
export function sanitizeHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "x-api-key" || lower === "cookie") {
      result[key] = REDACTED;
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ── Health Score Calculation ─────────────────────────────────

/**
 * Calculate a 0–100 health score for an API endpoint.
 * Weights: error rate (40%), p99 latency (35%), availability (25%)
 */
export function calculateHealthScore(metrics: {
  errorRate: number; // 0.0–1.0
  p99LatencyMs: number;
  totalCalls: number;
  consecutiveErrors?: number;
}): number {
  const { errorRate, p99LatencyMs, consecutiveErrors = 0 } = metrics;

  // Error rate score (0–40 points)
  const errorScore = Math.max(0, 40 - errorRate * 40 * 2.5);

  // Latency score (0–35 points)
  // 0ms = 35pts, 200ms = 28pts, 1000ms = 15pts, 5000ms+ = 0pts
  const latencyScore = Math.max(0, 35 - (p99LatencyMs / 5000) * 35);

  // Consecutive errors penalty
  const errorPenalty = Math.min(25, consecutiveErrors * 5);

  const score = errorScore + latencyScore + (25 - errorPenalty);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function healthScoreToStatus(score: number): "healthy" | "degraded" | "down" | "unknown" {
  if (score >= 80) return "healthy";
  if (score >= 50) return "degraded";
  if (score > 0) return "down";
  return "unknown";
}

// ── String Utilities ─────────────────────────────────────────

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + `...[truncated ${str.length - maxLength} chars]`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Time Utilities ───────────────────────────────────────────

export function now(): string {
  return new Date().toISOString();
}

export function subtractMinutes(minutes: number, from = new Date()): Date {
  return new Date(from.getTime() - minutes * 60 * 1000);
}

export function subtractHours(hours: number, from = new Date()): Date {
  return new Date(from.getTime() - hours * 60 * 60 * 1000);
}

export function subtractDays(days: number, from = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ── Percentile Calculation ───────────────────────────────────

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

export function p50(values: number[]): number { return percentile(values, 50); }
export function p95(values: number[]): number { return percentile(values, 95); }
export function p99(values: number[]): number { return percentile(values, 99); }

// ── HTTP Utilities ───────────────────────────────────────────

export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

export function isServerError(status: number): boolean {
  return status >= 500;
}

export function isErrorStatus(status: number): boolean {
  return status >= 400;
}

export function methodToColor(method: HttpMethod): string {
  const colors: Record<HttpMethod, string> = {
    GET: "#61affe",
    POST: "#49cc90",
    PUT: "#fca130",
    PATCH: "#50e3c2",
    DELETE: "#f93e3e",
    HEAD: "#9012fe",
    OPTIONS: "#0d5aa7",
  };
  return colors[method] ?? "#999";
}
