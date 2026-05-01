"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  timestamp: string;
  errorRate: number;
  requestCount?: number;
}

interface ErrorRateChartProps {
  data: DataPoint[];
  title?: string;
}

export function ErrorRateChart({ data, title }: ErrorRateChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    errorRatePct: +(d.errorRate * 100).toFixed(2),
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {title && <h3 className="mb-4 text-sm font-medium">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f93e3e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f93e3e" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(v: number) => [`${v}%`, "Error Rate"]}
          />
          <Area
            type="monotone"
            dataKey="errorRatePct"
            stroke="#f93e3e"
            fill="url(#errorGrad)"
            strokeWidth={2}
            name="Error Rate"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
