"use client";

import { useState } from "react";
import { Search, RefreshCw, Download, Cpu } from "lucide-react";
import { EndpointTable } from "@/components/api/endpoint-table";
import type { Endpoint } from "@/lib/api";

// Mock data for development
const MOCK_ENDPOINTS: Endpoint[] = [
  { id: "1", method: "GET", path: "/api/users", totalCalls: 12440, errorRate: 0.003, p50LatencyMs: 45, p95LatencyMs: 120, p99LatencyMs: 280, healthScore: 96, healthStatus: "healthy", lastSeen: new Date().toISOString() },
  { id: "2", method: "POST", path: "/api/auth/login", totalCalls: 8320, errorRate: 0.021, p50LatencyMs: 88, p95LatencyMs: 210, p99LatencyMs: 480, healthScore: 84, healthStatus: "healthy", lastSeen: new Date().toISOString() },
  { id: "3", method: "GET", path: "/api/users/:id", totalCalls: 43200, errorRate: 0.001, p50LatencyMs: 32, p95LatencyMs: 89, p99LatencyMs: 180, healthScore: 99, healthStatus: "healthy", lastSeen: new Date().toISOString() },
  { id: "4", method: "POST", path: "/api/payments", totalCalls: 3200, errorRate: 0.12, p50LatencyMs: 320, p95LatencyMs: 1200, p99LatencyMs: 4200, healthScore: 42, healthStatus: "down", lastSeen: new Date().toISOString() },
  { id: "5", method: "PUT", path: "/api/users/:id", totalCalls: 5600, errorRate: 0.008, p50LatencyMs: 65, p95LatencyMs: 190, p99LatencyMs: 420, healthScore: 88, healthStatus: "healthy", lastSeen: new Date().toISOString() },
  { id: "6", method: "DELETE", path: "/api/sessions/:id", totalCalls: 2100, errorRate: 0.045, p50LatencyMs: 28, p95LatencyMs: 88, p99LatencyMs: 200, healthScore: 71, healthStatus: "degraded", lastSeen: new Date().toISOString() },
  { id: "7", method: "GET", path: "/api/products", totalCalls: 28900, errorRate: 0.002, p50LatencyMs: 55, p95LatencyMs: 140, p99LatencyMs: 310, healthScore: 95, healthStatus: "healthy", lastSeen: new Date().toISOString() },
  { id: "8", method: "POST", path: "/api/orders", totalCalls: 4400, errorRate: 0.032, p50LatencyMs: 180, p95LatencyMs: 560, p99LatencyMs: 1800, healthScore: 62, healthStatus: "degraded", lastSeen: new Date().toISOString() },
];

export default function ApisPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Endpoint | null>(null);

  const filtered = MOCK_ENDPOINTS.filter(
    (ep) =>
      ep.path.toLowerCase().includes(search.toLowerCase()) ||
      ep.method.toLowerCase().includes(search.toLowerCase())
  );

  const summary = {
    total: MOCK_ENDPOINTS.length,
    healthy: MOCK_ENDPOINTS.filter((e) => e.healthStatus === "healthy").length,
    degraded: MOCK_ENDPOINTS.filter((e) => e.healthStatus === "degraded").length,
    down: MOCK_ENDPOINTS.filter((e) => e.healthStatus === "down").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            {summary.total} endpoints — {summary.healthy} healthy, {summary.degraded} degraded, {summary.down} down
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            <Download className="h-4 w-4" />
            Export OpenAPI
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            <Cpu className="h-4 w-4" />
            Run AI Analysis
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Endpoints", value: summary.total, color: "text-foreground" },
          { label: "Healthy", value: summary.healthy, color: "text-green-500" },
          { label: "Degraded", value: summary.degraded, color: "text-yellow-500" },
          { label: "Down", value: summary.down, color: "text-destructive" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter by path or method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Endpoint Table */}
      <EndpointTable endpoints={filtered} onSelect={setSelected} />

      {/* Selected Endpoint Detail Panel */}
      {selected && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                {selected.method}
              </span>
              <span className="font-mono text-lg font-semibold">{selected.path}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">&#x2715;</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Health Score</p>
              <p className="text-2xl font-bold mt-1">{selected.healthScore}/100</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">P99 Latency</p>
              <p className="text-2xl font-bold mt-1">{selected.p99LatencyMs}ms</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Error Rate</p>
              <p className="text-2xl font-bold mt-1">{(selected.errorRate * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Run Health Analysis
            </button>
            <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
              Generate Tests
            </button>
            <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
              View Traces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
