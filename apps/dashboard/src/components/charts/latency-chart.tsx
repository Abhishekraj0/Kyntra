"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  timestamp: string;
  p50Ms?: number;
  p95Ms?: number;
  p99Ms?: number;
  avgLatencyMs?: number;
}

interface LatencyChartProps {
  data: DataPoint[];
  title?: string;
}

export function LatencyChart({ data, title }: LatencyChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {title && <h3 className="mb-4 text-sm font-medium">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend />
          {formatted[0]?.p50Ms !== undefined && (
            <Line type="monotone" dataKey="p50Ms" stroke="#61affe" strokeWidth={2} dot={false} name="P50" />
          )}
          {formatted[0]?.p95Ms !== undefined && (
            <Line type="monotone" dataKey="p95Ms" stroke="#fca130" strokeWidth={2} dot={false} name="P95" />
          )}
          {formatted[0]?.p99Ms !== undefined && (
            <Line type="monotone" dataKey="p99Ms" stroke="#f93e3e" strokeWidth={2} dot={false} name="P99" />
          )}
          {formatted[0]?.avgLatencyMs !== undefined && (
            <Line type="monotone" dataKey="avgLatencyMs" stroke="#49cc90" strokeWidth={2} dot={false} name="Avg" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
