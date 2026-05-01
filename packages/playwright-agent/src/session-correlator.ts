/**
 * Correlates frontend UI events with backend API traces by session ID.
 * Enables root cause analysis that spans the full request lifecycle.
 */

import { generateId, now } from "@kyntra/shared";
import type { UiEvent, ApiTrace } from "@kyntra/shared";

export interface CorrelatedSession {
  sessionId: string;
  startTime: string;
  endTime: string;
  userId?: string | undefined;
  pageViews: string[];
  events: UiEventSummary[];
  apiCalls: ApiCallSummary[];
  errors: ErrorSummary[];
  funnelSteps: FunnelStep[];
  performanceMetrics: PerformanceMetrics;
}

export interface UiEventSummary {
  type: string;
  element?: string | undefined;
  url: string;
  timestamp: string;
  durationMs?: number | undefined;
}

export interface ApiCallSummary {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  triggeredByElement?: string | undefined;
}

export interface ErrorSummary {
  message: string;
  type: "js_error" | "network_error" | "api_error";
  url: string;
  timestamp: string;
}

export interface FunnelStep {
  step: number;
  name: string;
  timestamp: string;
  durationMs: number;
  apiCallCount: number;
  errorCount: number;
}

export interface PerformanceMetrics {
  totalSessionDurationMs: number;
  totalApiCalls: number;
  totalApiErrors: number;
  avgApiLatencyMs: number;
  p99ApiLatencyMs: number;
  pageViewCount: number;
  errorCount: number;
  apiErrorRate: number;
}

/**
 * Correlate UI events and API traces for a given session.
 */
export function correlateSession(
  sessionId: string,
  uiEvents: UiEvent[],
  apiTraces: ApiTrace[]
): CorrelatedSession {
  const sessionEvents = uiEvents.filter((e) => e.sessionId === sessionId);
  const sortedEvents = [...sessionEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sortedEvents.length === 0) {
    return createEmptySession(sessionId);
  }

  const startTime = sortedEvents[0]!.timestamp;
  const endTime = sortedEvents[sortedEvents.length - 1]!.timestamp;
  const sessionStart = new Date(startTime).getTime();
  const sessionEnd = new Date(endTime).getTime();

  // Match API traces to session time window
  const sessionTraces = apiTraces.filter((t) => {
    const ts = new Date(t.timestamp).getTime();
    return ts >= sessionStart - 1000 && ts <= sessionEnd + 5000;
  });

  // Build event summaries
  const events: UiEventSummary[] = sortedEvents.map((e) => ({
    type: e.type,
    element: e.element,
    url: e.url,
    timestamp: e.timestamp,
    durationMs: e.durationMs,
  }));

  // Build API call summaries with nearest UI event context
  const apiCalls: ApiCallSummary[] = sessionTraces.map((trace) => {
    const traceTime = new Date(trace.timestamp).getTime();
    // Find the UI event that happened just before this API call
    const triggerEvent = sortedEvents.reduce(
      (closest, event) => {
        const eventTime = new Date(event.timestamp).getTime();
        if (eventTime <= traceTime && traceTime - eventTime < 2000) {
          if (!closest || traceTime - eventTime < traceTime - new Date(closest.timestamp).getTime()) {
            return event;
          }
        }
        return closest;
      },
      null as UiEvent | null
    );

    return {
      method: trace.method,
      path: trace.path,
      statusCode: trace.statusCode,
      durationMs: trace.durationMs,
      timestamp: trace.timestamp,
      triggeredByElement: triggerEvent?.element,
    };
  });

  // Extract errors
  const errors: ErrorSummary[] = [
    ...sessionEvents
      .filter((e) => e.type === "error")
      .map((e) => ({
        message: String((e.metadata as Record<string, unknown>)["message"] ?? "Unknown error"),
        type: "js_error" as const,
        url: e.url,
        timestamp: e.timestamp,
      })),
    ...sessionTraces
      .filter((t) => t.statusCode >= 400)
      .map((t) => ({
        message: `HTTP ${t.statusCode} on ${t.method} ${t.path}`,
        type: "api_error" as const,
        url: t.url,
        timestamp: t.timestamp,
      })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Extract page views
  const pageViews = [
    ...new Set(
      sessionEvents
        .filter((e) => e.type === "navigation" || e.type === "page_load")
        .map((e) => e.url)
    ),
  ];

  // Build funnel steps from navigation events
  const navigationEvents = sortedEvents.filter(
    (e) => e.type === "navigation" || e.type === "page_load"
  );
  const funnelSteps: FunnelStep[] = navigationEvents.map((nav, i) => {
    const navTime = new Date(nav.timestamp).getTime();
    const nextNavTime =
      i < navigationEvents.length - 1
        ? new Date(navigationEvents[i + 1]!.timestamp).getTime()
        : sessionEnd;

    const stepApiCalls = sessionTraces.filter((t) => {
      const ts = new Date(t.timestamp).getTime();
      return ts >= navTime && ts < nextNavTime;
    });

    return {
      step: i + 1,
      name: new URL(nav.url, "http://x").pathname,
      timestamp: nav.timestamp,
      durationMs: nextNavTime - navTime,
      apiCallCount: stepApiCalls.length,
      errorCount: stepApiCalls.filter((t) => t.statusCode >= 400).length,
    };
  });

  // Performance metrics
  const allLatencies = sessionTraces.map((t) => t.durationMs).sort((a, b) => a - b);
  const errorCount = sessionTraces.filter((t) => t.statusCode >= 400).length;

  const metrics: PerformanceMetrics = {
    totalSessionDurationMs: sessionEnd - sessionStart,
    totalApiCalls: sessionTraces.length,
    totalApiErrors: errorCount,
    avgApiLatencyMs:
      allLatencies.length > 0
        ? Math.round(allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length)
        : 0,
    p99ApiLatencyMs: allLatencies[Math.floor(allLatencies.length * 0.99)] ?? 0,
    pageViewCount: pageViews.length,
    errorCount: errors.length,
    apiErrorRate: sessionTraces.length > 0 ? errorCount / sessionTraces.length : 0,
  };

  return {
    sessionId,
    startTime,
    endTime,
    userId: sessionEvents.find((e) => e.userId)?.userId,
    pageViews,
    events,
    apiCalls,
    errors,
    funnelSteps,
    performanceMetrics: metrics,
  };
}

function createEmptySession(sessionId: string): CorrelatedSession {
  const timestamp = now();
  return {
    sessionId,
    startTime: timestamp,
    endTime: timestamp,
    pageViews: [],
    events: [],
    apiCalls: [],
    errors: [],
    funnelSteps: [],
    performanceMetrics: {
      totalSessionDurationMs: 0,
      totalApiCalls: 0,
      totalApiErrors: 0,
      avgApiLatencyMs: 0,
      p99ApiLatencyMs: 0,
      pageViewCount: 0,
      errorCount: 0,
      apiErrorRate: 0,
    },
  };
}

/**
 * Identify the top N sessions with the most errors or slowest API calls.
 */
export function findProblematicSessions(
  sessions: CorrelatedSession[],
  topN = 10
): CorrelatedSession[] {
  return [...sessions]
    .sort((a, b) => {
      const scoreA = a.performanceMetrics.errorCount * 10 + a.performanceMetrics.totalApiErrors * 5;
      const scoreB = b.performanceMetrics.errorCount * 10 + b.performanceMetrics.totalApiErrors * 5;
      return scoreB - scoreA;
    })
    .slice(0, topN);
}
