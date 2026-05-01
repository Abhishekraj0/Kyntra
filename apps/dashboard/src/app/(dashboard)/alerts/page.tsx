"use client";

import { useState } from "react";
import { Bell, Plus, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MOCK_ALERTS = [
  { id: "1", ruleName: "High Error Rate", message: "POST /api/payments error rate is 12.4% (> 5%)", severity: "critical", triggeredAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), resolvedAt: null },
  { id: "2", ruleName: "P99 Latency Spike", message: "GET /api/users/:id P99 is 4200ms (> 2000ms)", severity: "high", triggeredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), resolvedAt: null },
  { id: "3", ruleName: "Health Score Drop", message: "Average health score 65/100 (< 70 threshold)", severity: "medium", triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), resolvedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
];

const MOCK_RULES = [
  { id: "r1", name: "High Error Rate", type: "threshold", severity: "critical", enabled: true, condition: { metric: "error_rate", operator: "gt", value: 5, windowMinutes: 5 } },
  { id: "r2", name: "P99 Latency Spike", type: "threshold", severity: "high", enabled: true, condition: { metric: "p99_latency_ms", operator: "gt", value: 2000, windowMinutes: 5 } },
  { id: "r3", name: "Health Score Drop", type: "health_score", severity: "medium", enabled: true, condition: { metric: "health_score", operator: "lt", value: 70, windowMinutes: 10 } },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "outline",
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<"events" | "rules">("events");

  const activeAlerts = MOCK_ALERTS.filter((a) => !a.resolvedAt);
  const resolvedAlerts = MOCK_ALERTS.filter((a) => a.resolvedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground mt-1">Alert rules and event history</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      {/* Active Alert Banner */}
      {activeAlerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            {activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""} require attention
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {(["events", "rules"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm capitalize transition-colors ${
              activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "events" && (
        <div className="space-y-3">
          {MOCK_ALERTS.map((alert) => (
            <div key={alert.id} className={`flex items-start gap-4 rounded-xl border bg-card p-5 ${alert.resolvedAt ? "opacity-60" : ""}`}>
              <div className={`mt-0.5 rounded-full p-1.5 ${alert.resolvedAt ? "bg-green-500/10" : "bg-destructive/10"}`}>
                {alert.resolvedAt
                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                  : <Bell className="h-4 w-4 text-destructive" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{alert.ruleName}</p>
                  <Badge variant={(SEVERITY_COLORS[alert.severity] ?? "outline") as "default" | "success" | "warning" | "destructive" | "info" | "outline"}>
                    {alert.severity}
                  </Badge>
                  {alert.resolvedAt && <Badge variant="success">resolved</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{alert.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Triggered {new Date(alert.triggeredAt).toLocaleString()}
                  </span>
                  {alert.resolvedAt && (
                    <span>Resolved {new Date(alert.resolvedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>
              {!alert.resolvedAt && (
                <button className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent">
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "rules" && (
        <div className="space-y-3">
          {MOCK_RULES.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${rule.enabled ? "bg-green-500" : "bg-muted"}`} />
                <div>
                  <p className="font-medium text-sm">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.condition.metric} {rule.condition.operator} {rule.condition.value} · {rule.condition.windowMinutes}min window
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={(SEVERITY_COLORS[rule.severity] ?? "outline") as "default" | "success" | "warning" | "destructive" | "info" | "outline"}>
                  {rule.severity}
                </Badge>
                <Badge variant={rule.enabled ? "success" : "outline"}>
                  {rule.enabled ? "enabled" : "disabled"}
                </Badge>
                <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
