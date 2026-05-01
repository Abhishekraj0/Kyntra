"use client";

import type { Endpoint } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EndpointTableProps {
  endpoints: Endpoint[];
  onSelect?: (endpoint: Endpoint) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-blue-500 bg-blue-500/10",
  POST: "text-green-500 bg-green-500/10",
  PUT: "text-orange-500 bg-orange-500/10",
  PATCH: "text-cyan-500 bg-cyan-500/10",
  DELETE: "text-red-500 bg-red-500/10",
};

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums">{score}</span>
    </div>
  );
}

export function EndpointTable({ endpoints, onSelect }: EndpointTableProps) {
  if (endpoints.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No endpoints found. Install the Kyntra SDK to start capturing API traffic.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Endpoint</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Calls</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Error Rate</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">P50</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">P99</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Health</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep) => (
            <tr
              key={ep.id}
              className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onSelect?.(ep)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold font-mono", METHOD_COLORS[ep.method] ?? "text-muted-foreground bg-muted")}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-sm">{ep.path}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums">
                {ep.totalCalls.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <span className={cn("text-sm tabular-nums", ep.errorRate > 0.05 ? "text-destructive" : "text-muted-foreground")}>
                  {(ep.errorRate * 100).toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                {ep.p50LatencyMs}ms
              </td>
              <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                {ep.p99LatencyMs}ms
              </td>
              <td className="px-4 py-3 text-right">
                <HealthBar score={ep.healthScore} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
