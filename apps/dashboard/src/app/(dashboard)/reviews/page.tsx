"use client";

import { useState, useEffect } from "react";
import { GitPullRequest, Shield, Zap, Bug, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getReviews, type Review } from "@/lib/api";

const MOCK_REVIEWS = [
  {
    id: "1", prNumber: 241, prTitle: "Add payment retry logic with exponential backoff",
    prAuthor: "alice", riskScore: 72, status: "complete", prUrl: "#",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2", prNumber: 238, prTitle: "Refactor authentication middleware to use JWT RS256",
    prAuthor: "bob", riskScore: 45, status: "complete", prUrl: "#",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3", prNumber: 235, prTitle: "Update API rate limiting configuration",
    prAuthor: "charlie", riskScore: 88, status: "analyzing", prUrl: "#",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function RiskGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#f93e3e" : score >= 50 ? "#fca130" : "#49cc90";
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${(score / 100) * 94} 94`} strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-sm font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-muted-foreground">risk</p>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const projectId = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("projectId") ?? "")
    : "";

  useEffect(() => {
    void fetchReviews();
  }, [projectId]);

  async function fetchReviews() {
    setLoading(true);
    try {
      if (projectId) {
        const res = await getReviews(projectId);
        setReviews(res.data);
      } else {
        setReviews(MOCK_REVIEWS as Review[]);
      }
    } catch {
      setReviews(MOCK_REVIEWS as Review[]);
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: reviews.length,
    highRisk: reviews.filter((r) => r.riskScore >= 80).length,
    avg: reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.riskScore, 0) / reviews.length) : 0,
    complete: reviews.filter((r) => r.status === "complete").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Code Reviews</h1>
          <p className="text-muted-foreground mt-1">AI-powered pull request analysis and risk scoring</p>
        </div>
        <button
          onClick={() => void fetchReviews()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Reviews", value: stats.total, color: "text-foreground" },
          { label: "High Risk", value: stats.highRisk, color: "text-destructive" },
          { label: "Avg Risk Score", value: stats.avg, color: "text-yellow-500" },
          { label: "Completed", value: stats.complete, color: "text-green-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground text-sm">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <GitPullRequest className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No reviews yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Connect your GitHub repository in Settings to enable automatic PR reviews.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <GitPullRequest className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={review.prUrl} target="_blank" rel="noopener noreferrer"
                        className="font-medium hover:underline flex items-center gap-1">
                        #{review.prNumber} — {review.prTitle}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <Badge variant={
                        review.status === "analyzing" ? "info" :
                        review.status === "complete" ? "success" :
                        review.status === "failed" ? "destructive" : "outline"
                      }>
                        {review.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground">
                        by @{review.prAuthor} · {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>
                <RiskGauge score={review.riskScore} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
