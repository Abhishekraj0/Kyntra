"use client";

import { useState } from "react";
import { ShieldCheck, TrendingUp, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

const MOCK_SLA_CURRENT = {
  uptime: "99.94%",
  slaTarget: "99.9%",
  slaAchieved: true,
  totalRequests24h: 2400000,
  errorRate24h: 0.0006,
  totalEndpoints: 47,
  healthyEndpoints: 44,
  degradedEndpoints: 2,
  downEndpoints: 1,
  avgP99Ms: 280,
};

const MOCK_SLA_HISTORY = [
  { period: "Jan 8", uptime: 99.97, requests: 18200000, slaAchieved: true },
  { period: "Jan 9", uptime: 99.94, requests: 17800000, slaAchieved: true },
  { period: "Jan 10", uptime: 99.88, requests: 19100000, slaAchieved: false },
  { period: "Jan 11", uptime: 99.93, requests: 17400000, slaAchieved: true },
  { period: "Jan 12", uptime: 99.99, requests: 21200000, slaAchieved: true },
  { period: "Jan 13", uptime: 99.96, requests: 15800000, slaAchieved: true },
  { period: "Jan 14", uptime: 99.94, requests: 18900000, slaAchieved: true },
];

export default function SlaPage() {
  const [computing, setComputing] = useState(false);

  const current = MOCK_SLA_CURRENT;
  const daysAboveSla = MOCK_SLA_HISTORY.filter((d) => d.slaAchieved).length;
  const avgUptime = (MOCK_SLA_HISTORY.reduce((s, d) => s + d.uptime, 0) / MOCK_SLA_HISTORY.length).toFixed(3);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">SLA Tracking</h1>
          <p className="text-muted-foreground mt-1">Service level agreement monitoring and reporting</p>
        </div>
        <button
          onClick={() => setComputing(true)}
          disabled={computing}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${computing ? "animate-spin" : ""}`} />
          Compute SLA
        </button>
      </div>

      {/* Current SLA Status Banner */}
      <div className={`flex items-center gap-4 rounded-xl border p-5 ${
        current.slaAchieved
          ? "border-green-500/20 bg-green-500/5"
          : "border-destructive/20 bg-destructive/5"
      }`}>
        <div className={`rounded-full p-3 ${current.slaAchieved ? "bg-green-500/10" : "bg-destructive/10"}`}>
          <ShieldCheck className={`h-6 w-6 ${current.slaAchieved ? "text-green-500" : "text-destructive"}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-lg font-bold ${current.slaAchieved ? "text-green-500" : "text-destructive"}`}>
              {current.uptime} Uptime
            </p>
            <Badge variant={current.slaAchieved ? "success" : "destructive"}>
              {current.slaAchieved ? "SLA Met" : "SLA Breached"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Target: {current.slaTarget} · {(current.errorRate24h * 100).toFixed(4)}% error rate · Last 24 hours
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{daysAboveSla}/{MOCK_SLA_HISTORY.length}</p>
          <p className="text-xs text-muted-foreground">days above SLA target</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Current Uptime" value={current.uptime} subtitle="Target: 99.9%" icon={ShieldCheck} iconColor="text-green-500" trend="up" trendValue="above target" />
        <StatCard title="Avg Uptime (7d)" value={`${avgUptime}%`} icon={TrendingUp} iconColor="text-blue-500" />
        <StatCard title="P99 Latency" value={`${current.avgP99Ms}ms`} subtitle="across all endpoints" icon={Clock} iconColor="text-orange-500" />
        <StatCard title="Degraded/Down" value={`${current.degradedEndpoints + current.downEndpoints}`} subtitle={`of ${current.totalEndpoints} endpoints`} icon={AlertTriangle} iconColor="text-destructive" />
      </div>

      {/* Uptime History Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Daily Uptime (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={MOCK_SLA_HISTORY} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
            <YAxis
              domain={[99.5, 100]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
              formatter={(v: number) => [`${v}%`, "Uptime"]}
            />
            <ReferenceLine y={99.9} stroke="#fca130" strokeDasharray="4 4" label={{ value: "SLA Target 99.9%", position: "right", fontSize: 10, fill: "#fca130" }} />
            <Bar dataKey="uptime" fill="#61affe" radius={[4, 4, 0, 0]}
              label={{ position: "top", fontSize: 9, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v}%` }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Endpoint Health Grid */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Endpoint Health Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Healthy", count: current.healthyEndpoints, color: "text-green-500 bg-green-500/10" },
            { label: "Degraded", count: current.degradedEndpoints, color: "text-yellow-500 bg-yellow-500/10" },
            { label: "Down", count: current.downEndpoints, color: "text-destructive bg-destructive/10" },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-xl p-4 ${color.split(" ")[1]}`}>
              <p className={`text-3xl font-bold ${color.split(" ")[0]}`}>{count}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full flex">
            <div className="bg-green-500" style={{ width: `${(current.healthyEndpoints / current.totalEndpoints) * 100}%` }} />
            <div className="bg-yellow-500" style={{ width: `${(current.degradedEndpoints / current.totalEndpoints) * 100}%` }} />
            <div className="bg-destructive" style={{ width: `${(current.downEndpoints / current.totalEndpoints) * 100}%` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">{current.totalEndpoints} total endpoints</p>
      </div>
    </div>
  );
}
