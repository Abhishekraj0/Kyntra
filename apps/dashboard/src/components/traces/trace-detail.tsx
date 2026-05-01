import { cn } from "@/lib/utils";

interface TraceDetailProps {
  traceId: string;
  spans?: TraceSpan[];
}

interface TraceSpan {
  spanId: string;
  service: string;
  operation: string;
  durationMs: number;
  startOffsetMs: number;
  statusCode?: number;
  error?: boolean;
}

export function TraceDetail({ traceId, spans = [] }: TraceDetailProps) {
  if (spans.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-medium mb-1">Trace: {traceId.slice(0, 16)}...</h3>
        <p className="text-sm text-muted-foreground">Single-span trace (no distributed context)</p>
      </div>
    );
  }

  const totalMs = Math.max(...spans.map((s) => s.startOffsetMs + s.durationMs));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-medium mb-4">Distributed Trace: <code className="text-xs bg-muted px-1 py-0.5 rounded">{traceId.slice(0, 16)}...</code></h3>

      <div className="space-y-2">
        {spans.sort((a, b) => a.startOffsetMs - b.startOffsetMs).map((span) => (
          <div key={span.spanId} className="flex items-center gap-3">
            <div className="w-40 shrink-0">
              <p className="text-xs font-medium truncate">{span.service}</p>
              <p className="text-xs text-muted-foreground truncate">{span.operation}</p>
            </div>
            <div className="flex-1 relative h-6">
              <div className="absolute inset-y-0 w-full rounded bg-muted/50" />
              <div
                className={cn(
                  "absolute inset-y-1 rounded",
                  span.error ? "bg-destructive/60" : "bg-primary/60"
                )}
                style={{
                  left: `${(span.startOffsetMs / totalMs) * 100}%`,
                  width: `${Math.max(2, (span.durationMs / totalMs) * 100)}%`,
                }}
              />
            </div>
            <span className="w-16 text-right text-xs tabular-nums text-muted-foreground shrink-0">
              {span.durationMs}ms
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3">Total: {totalMs}ms across {spans.length} spans</p>
    </div>
  );
}
