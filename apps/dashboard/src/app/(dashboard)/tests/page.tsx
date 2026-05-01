"use client";

import { useState } from "react";
import { TestTube2, Play, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MOCK_TESTS = [
  { id: "1", name: "GET /api/users — generated tests", type: "integration", framework: "vitest", status: "passed", createdAt: "2024-01-15", lastRunAt: "2024-01-15T12:00:00Z", lastRunDurationMs: 342 },
  { id: "2", name: "POST /api/auth/login — generated tests", type: "integration", framework: "vitest", status: "failed", createdAt: "2024-01-14", lastRunAt: "2024-01-15T11:30:00Z", lastRunDurationMs: 510 },
  { id: "3", name: "POST /api/payments — integration tests", type: "integration", framework: "vitest", status: "pending", createdAt: "2024-01-13", lastRunAt: undefined, lastRunDurationMs: undefined },
  { id: "4", name: "GET /api/products — smoke tests", type: "unit", framework: "jest", status: "passed", createdAt: "2024-01-12", lastRunAt: "2024-01-15T10:00:00Z", lastRunDurationMs: 125 },
  { id: "5", name: "E2E: Checkout flow", type: "e2e", framework: "playwright", status: "passed", createdAt: "2024-01-10", lastRunAt: "2024-01-15T09:00:00Z", lastRunDurationMs: 8200 },
];

const STATUS_CONFIG = {
  passed: { icon: CheckCircle2, color: "text-green-500", badge: "success" as const },
  failed: { icon: XCircle, color: "text-destructive", badge: "destructive" as const },
  pending: { icon: Clock, color: "text-muted-foreground", badge: "outline" as const },
  running: { icon: Play, color: "text-blue-500", badge: "info" as const },
};

export default function TestsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const stats = {
    total: MOCK_TESTS.length,
    passed: MOCK_TESTS.filter((t) => t.status === "passed").length,
    failed: MOCK_TESTS.filter((t) => t.status === "failed").length,
    pending: MOCK_TESTS.filter((t) => t.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Suite</h1>
          <p className="text-muted-foreground mt-1">AI-generated and manually created tests</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Generate Tests
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Tests", value: stats.total, color: "text-foreground" },
          { label: "Passing", value: stats.passed, color: "text-green-500" },
          { label: "Failing", value: stats.failed, color: "text-destructive" },
          { label: "Pending", value: stats.pending, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Test List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Test</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Framework</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Duration</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TESTS.map((test) => {
              const config = STATUS_CONFIG[test.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              const Icon = config.icon;
              return (
                <tr key={test.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
                      <span className="text-sm">{test.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{test.type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground">{test.framework}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={config.badge}>{test.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                    {test.lastRunDurationMs ? `${test.lastRunDurationMs}ms` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded px-2 py-1 text-xs hover:bg-accent">
                      <Play className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
