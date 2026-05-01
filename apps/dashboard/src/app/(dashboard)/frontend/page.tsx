"use client";

import { useState, useEffect } from "react";
import { Monitor, MousePointer, AlertCircle, Gauge, Activity, RefreshCw, Zap } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

interface SessionData {
  sessionId: string;
  pageViews: number;
  apiCalls: number;
  errors: number;
  durationMs: number;
  qualityScore: number;
}

interface WebVitalData {
  name: string;
  value: number;
  unit: string;
  status: "good" | "needs-improvement" | "poor";
  target: string;
}

const MOCK_VITALS: WebVitalData[] = [
  { name: "LCP", value: 1.8, unit: "s", status: "good", target: "< 2.5s" },
  { name: "FID", value: 42, unit: "ms", status: "good", target: "< 100ms" },
  { name: "CLS", value: 0.08, unit: "", status: "needs-improvement", target: "< 0.1" },
  { name: "TTFB", value: 180, unit: "ms", status: "good", target: "< 800ms" },
  { name: "FCP", value: 1.1, unit: "s", status: "good", target: "< 1.8s" },
  { name: "INP", value: 88, unit: "ms", status: "good", target: "< 200ms" },
];

const MOCK_SESSIONS: SessionData[] = [
  { sessionId: "sess_01", pageViews: 5, apiCalls: 12, errors: 0, durationMs: 340000, qualityScore: 95 },
  { sessionId: "sess_02", pageViews: 3, apiCalls: 8, errors: 2, durationMs: 120000, qualityScore: 68 },
  { sessionId: "sess_03", pageViews: 8, apiCalls: 24, errors: 0, durationMs: 780000, qualityScore: 92 },
  { sessionId: "sess_04", pageViews: 2, apiCalls: 4, errors: 1, durationMs: 45000, qualityScore: 71 },
  { sessionId: "sess_05", pageViews: 6, apiCalls: 18, errors: 3, durationMs: 560000, qualityScore: 54 },
];

const MOCK_INTERACTIONS = [
  { action: "Click: button.btn-checkout", count: 4210, p99Ms: 380, errorRate: 0.02 },
  { action: "Navigation: /cart → /checkout", count: 3890, p99Ms: 920, errorRate: 0.05 },
  { action: "Click: .product-card", count: 12400, p99Ms: 120, errorRate: 0.001 },
  { action: "Form Submit: #login-form", count: 2100, p99Ms: 480, errorRate: 0.03 },
  { action: "Navigation: / → /products", count: 8900, p99Ms: 210, errorRate: 0.01 },
];

const VITAL_STATUS_COLORS = {
  good: "text-green-500 bg-green-500/10",
  "needs-improvement": "text-yellow-500 bg-yellow-500/10",
  poor: "text-destructive bg-destructive/10",
};

export default function FrontendPage() {
  const [loading] = useState(false);

  const totalSessions = MOCK_SESSIONS.length;
  const avgQuality = Math.round(MOCK_SESSIONS.reduce((s, r) => s + r.qualityScore, 0) / totalSessions);
  const totalErrors = MOCK_SESSIONS.reduce((s, r) => s + r.errors, 0);
  const totalInteractions = MOCK_INTERACTIONS.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Frontend Agent</h1>
          <p className="text-muted-foreground mt-1">UI behavior, Web Vitals, session correlation, and E2E test generation</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* SDK Setup Prompt */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Monitor className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Add the Browser SDK to capture frontend data</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Auto-captures clicks, navigation, errors, and Web Vitals.</p>
            <pre className="rounded-lg bg-card border border-border p-3 text-xs font-mono overflow-x-auto">
{`import { KyntraBrowser } from '@kyntra/sdk/browser';
KyntraBrowser.init({ projectId: 'your_proj_id', apiKey: 'kyn_live_xxx' });`}
            </pre>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Sessions (24h)" value={totalSessions.toLocaleString()} icon={Activity} iconColor="text-blue-500" />
        <StatCard title="Avg Session Quality" value={`${avgQuality}/100`} icon={Gauge} iconColor="text-green-500" />
        <StatCard title="Total Interactions" value={totalInteractions.toLocaleString()} icon={MousePointer} iconColor="text-purple-500" />
        <StatCard title="JS Errors" value={totalErrors} icon={AlertCircle} iconColor="text-destructive" />
      </div>

      {/* Web Vitals */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Core Web Vitals</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {MOCK_VITALS.map((vital) => (
            <div key={vital.name} className="rounded-xl border border-border bg-card p-4 text-center">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${VITAL_STATUS_COLORS[vital.status]}`}>
                {vital.status === "good" ? "Good" : vital.status === "needs-improvement" ? "Improve" : "Poor"}
              </span>
              <p className="text-lg font-bold">{vital.value}{vital.unit}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">{vital.name}</p>
              <p className="text-xs text-muted-foreground">target {vital.target}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Interactions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-medium mb-4">Top User Interactions (24h)</h3>
          <div className="space-y-2">
            {MOCK_INTERACTIONS.map((item) => (
              <div key={item.action} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <MousePointer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">{item.action}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="tabular-nums text-muted-foreground">{item.count.toLocaleString()}</span>
                  <span className={`tabular-nums ${item.p99Ms > 500 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {item.p99Ms}ms p99
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Quality */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Recent Sessions</h3>
            <button className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Zap className="h-3 w-3" />
              Generate E2E Tests
            </button>
          </div>
          <div className="space-y-2">
            {MOCK_SESSIONS.map((session) => (
              <div key={session.sessionId} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted/30">
                <div>
                  <p className="text-xs font-mono">{session.sessionId}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.pageViews} pages · {session.apiCalls} API calls
                    {session.errors > 0 && <span className="text-destructive"> · {session.errors} errors</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${session.qualityScore >= 80 ? "bg-green-500" : session.qualityScore >= 60 ? "bg-yellow-500" : "bg-destructive"}`}
                      style={{ width: `${session.qualityScore}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-6">{session.qualityScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
