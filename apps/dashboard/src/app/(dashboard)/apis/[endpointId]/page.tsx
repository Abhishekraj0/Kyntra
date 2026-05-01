"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Cpu, TestTube2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { LatencyChart } from "@/components/charts/latency-chart";
import { ErrorRateChart } from "@/components/charts/error-rate-chart";
import { TraceTimeline } from "@/components/traces/trace-timeline";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Trace, Endpoint } from "@/lib/api";

interface TimeSeriesPoint {
  timestamp: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  requestCount: number;
}

interface EndpointStats {
  endpoint: Endpoint;
  stats: { totalCalls: number; errorRate: number; p50Ms: number; p95Ms: number; p99Ms: number };
  timeSeries: TimeSeriesPoint[];
}

// Use query param ?projectId= and path param
export default function EndpointDetailPage({
  params,
  searchParams,
}: {
  params: { endpointId: string };
  searchParams: { projectId?: string };
}) {
  const { endpointId } = params;
  const projectId = searchParams.projectId ?? "";

  const [stats, setStats] = useState<EndpointStats | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, [endpointId, projectId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, tracesRes] = await Promise.all([
        api.get<{ data: EndpointStats }>(`/v1/apis/${endpointId}/stats`),
        api.get<{ data: { traces: Trace[] } }>(`/v1/traces?projectId=${projectId}&limit=100`),
      ]);
      setStats(statsRes.data);
      setTraces(tracesRes.data.traces);
    } catch {
      // fallback: show empty state
    } finally {
      setLoading(false);
    }
  }

  async function runHealthAnalysis() {
    if (!projectId) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await api.post<{ analysisId: string }>("/v1/analyze", {
        type: "api_health",
        projectId,
        options: { endpointId, windowMinutes: 60 },
      });

      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const result = await api.get<{ status: string; summary: string; output: unknown }>(
          `/v1/analyze/${res.analysisId}`
        );
        if (result.status === "complete") {
          setAnalysisResult(result.summary);
          break;
        }
        if (result.status === "failed") {
          setAnalysisResult("Analysis failed. Check your API key and try again.");
          break;
        }
        attempts++;
      }
    } catch {
      setAnalysisResult("Failed to start analysis.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Loading endpoint data...</div>
      </div>
    );
  }

  const ep = stats?.endpoint;
  const ts = stats?.timeSeries ?? [];

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/apis" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to APIs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {ep && (
            <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
              {ep.method}
            </span>
          )}
          <h1 className="text-xl font-bold font-mono">{ep?.path ?? endpointId}</h1>
          {ep && (
            <Badge variant={ep.healthStatus === "healthy" ? "success" : ep.healthStatus === "degraded" ? "warning" : "destructive"}>
              {ep.healthStatus}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => void fetchData()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => void runHealthAnalysis()}
            disabled={analyzing}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Cpu className="h-4 w-4" />
            {analyzing ? "Analyzing..." : "AI Health Analysis"}
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
            <TestTube2 className="h-4 w-4" />
            Generate Tests
          </button>
        </div>
      </div>

      {/* Analysis Result Banner */}
      {analysisResult && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">AI Analysis Complete</p>
          <p className="text-sm text-muted-foreground mt-1">{analysisResult}</p>
        </div>
      )}

      {/* Stats */}
      {ep && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Health Score" value={`${ep.healthScore}/100`} subtitle={ep.healthStatus} />
          <StatCard title="Total Calls" value={ep.totalCalls.toLocaleString()} />
          <StatCard title="Error Rate" value={`${(ep.errorRate * 100).toFixed(2)}%`} />
          <StatCard title="P99 Latency" value={`${ep.p99LatencyMs}ms`} />
        </div>
      )}

      {/* Charts */}
      {ts.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LatencyChart
            data={ts.map((d) => ({ timestamp: d.timestamp, avgLatencyMs: d.avgLatencyMs, p99Ms: d.p99LatencyMs }))}
            title="Latency over time"
          />
          <ErrorRateChart data={ts} title="Error rate over time" />
        </div>
      )}

      {/* Trace Timeline */}
      <TraceTimeline traces={traces} title={`Recent Traces (${traces.length})`} />
    </div>
  );
}
