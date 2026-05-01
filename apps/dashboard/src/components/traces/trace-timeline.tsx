"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Trace } from "@/lib/api";

interface TraceTimelineProps {
  traces: Trace[];
  title?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  POST: "bg-green-500/20 text-green-400 border-green-500/30",
  PUT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  PATCH: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

function statusColor(code: number): string {
  if (code < 300) return "text-green-400";
  if (code < 400) return "text-yellow-400";
  if (code < 500) return "text-orange-400";
  return "text-red-400";
}

function durationBar(ms: number, max: number): number {
  return Math.max(4, (ms / max) * 100);
}

export function TraceTimeline({ traces, title }: TraceTimelineProps) {
  const [selected, setSelected] = useState<Trace | null>(null);

  if (traces.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground text-sm">No traces recorded yet.</p>
      </div>
    );
  }

  const maxDuration = Math.max(...traces.map((t) => t.durationMs));

  return (
    <div className="rounded-xl border border-border bg-card">
      {title && (
        <div className="border-b border-border px-6 py-4">
          <h3 className="font-medium">{title}</h3>
        </div>
      )}

      <div className="divide-y divide-border/50">
        {traces.slice(0, 50).map((trace) => (
          <div
            key={trace.id}
            onClick={() => setSelected(selected?.id === trace.id ? null : trace)}
            className={cn(
              "cursor-pointer px-6 py-3 hover:bg-muted/30 transition-colors",
              selected?.id === trace.id && "bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Method badge */}
              <span className={cn(
                "shrink-0 rounded border px-1.5 py-0.5 text-xs font-bold font-mono",
                METHOD_COLORS[trace.method] ?? "bg-muted text-muted-foreground border-border"
              )}>
                {trace.method}
              </span>

              {/* Path */}
              <span className="font-mono text-sm flex-1 truncate">{trace.path ?? trace.url}</span>

              {/* Status */}
              <span className={cn("text-sm tabular-nums font-medium shrink-0", statusColor(trace.statusCode))}>
                {trace.statusCode}
              </span>

              {/* Duration bar */}
              <div className="flex items-center gap-2 shrink-0 w-32">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      trace.durationMs > 1000 ? "bg-red-500" :
                      trace.durationMs > 300 ? "bg-yellow-500" : "bg-green-500"
                    )}
                    style={{ width: `${durationBar(trace.durationMs, maxDuration)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">
                  {trace.durationMs}ms
                </span>
              </div>

              {/* Timestamp */}
              <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                {new Date(trace.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* Expanded detail */}
            {selected?.id === trace.id && (
              <div className="mt-3 rounded-lg bg-muted/50 p-4 space-y-2 text-xs font-mono">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <span className="text-muted-foreground">URL</span>
                  <span className="truncate">{trace.url}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span className={statusColor(trace.statusCode)}>{trace.statusCode}</span>
                  <span className="text-muted-foreground">Duration</span>
                  <span>{trace.durationMs}ms</span>
                  <span className="text-muted-foreground">Environment</span>
                  <span>{trace.environment}</span>
                  <span className="text-muted-foreground">Timestamp</span>
                  <span>{new Date(trace.timestamp).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {traces.length > 50 && (
        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">Showing 50 of {traces.length} traces</p>
        </div>
      )}
    </div>
  );
}
