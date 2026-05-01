import { Globe, GitPullRequest, TestTube2, Zap, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">System Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time engineering intelligence across your entire stack</p>
      </div>

      {/* System Health Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-500">All systems operational</p>
          <p className="text-xs text-muted-foreground">Last checked 30 seconds ago · 99.94% uptime (30d)</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="API Endpoints"
          value="47"
          subtitle="3 degraded"
          icon={Globe}
          trend="up"
          trendValue="+4 new"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Requests (24h)"
          value="2.4M"
          subtitle="avg 99.2ms latency"
          icon={Activity}
          trend="up"
          trendValue="12% more"
          iconColor="text-green-500"
        />
        <StatCard
          title="Error Rate"
          value="0.8%"
          subtitle="38 errors in last hour"
          icon={AlertTriangle}
          trend="down"
          trendValue="0.3% lower"
          iconColor="text-orange-500"
        />
        <StatCard
          title="AI Reviews"
          value="12"
          subtitle="3 high risk PRs"
          icon={GitPullRequest}
          trend="neutral"
          trendValue="same as yesterday"
          iconColor="text-purple-500"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Issues */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 font-medium">Recent Issues</h3>
          <div className="space-y-3">
            {[
              { type: "critical", msg: "POST /api/payments — error rate spike (12%)", time: "2m ago" },
              { type: "warning", msg: "GET /api/users/:id — P99 latency 4.2s", time: "15m ago" },
              { type: "info", msg: "New endpoint detected: DELETE /api/sessions", time: "1h ago" },
              { type: "success", msg: "Anomaly resolved: /api/products latency normalized", time: "3h ago" },
            ].map((issue, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/30">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                  issue.type === "critical" ? "bg-destructive" :
                  issue.type === "warning" ? "bg-yellow-500" :
                  issue.type === "info" ? "bg-blue-500" : "bg-green-500"
                }`} />
                <div>
                  <p className="text-sm">{issue.msg}</p>
                  <p className="text-xs text-muted-foreground">{issue.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 font-medium">Recent Code Reviews</h3>
          <div className="space-y-3">
            {[
              { pr: "#241 — Add payment retry logic", risk: 72, status: "complete", author: "alice" },
              { pr: "#238 — Refactor auth middleware", risk: 45, status: "complete", author: "bob" },
              { pr: "#235 — Update API rate limiting", risk: 88, status: "analyzing", author: "charlie" },
              { pr: "#233 — Fix memory leak in queue", risk: 91, status: "complete", author: "alice" },
            ].map((review, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg p-3 hover:bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{review.pr}</p>
                  <p className="text-xs text-muted-foreground">by @{review.author}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-12 overflow-hidden rounded-full bg-muted`}>
                    <div
                      className={`h-full ${review.risk >= 80 ? "bg-destructive" : review.risk >= 50 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${review.risk}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-8">{review.risk}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 font-medium">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Run Health Check", icon: Activity, color: "text-green-500" },
            { label: "Generate Tests", icon: TestTube2, color: "text-blue-500" },
            { label: "Export OpenAPI Spec", icon: Globe, color: "text-orange-500" },
            { label: "Generate Report", icon: Zap, color: "text-purple-500" },
          ].map(({ label, icon: Icon, color }) => (
            <button
              key={label}
              className="flex items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
