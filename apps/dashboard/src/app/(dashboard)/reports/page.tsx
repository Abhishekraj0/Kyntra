import { FileBarChart, Plus, Download, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MOCK_REPORTS = [
  { id: "1", title: "Weekly System Health Report — Jan 15, 2024", type: "weekly", createdAt: "2024-01-15T09:00:00Z", sections: 5 },
  { id: "2", title: "Incident Report — Payment Service Outage", type: "incident", createdAt: "2024-01-12T14:30:00Z", sections: 7 },
  { id: "3", title: "Weekly System Health Report — Jan 8, 2024", type: "weekly", createdAt: "2024-01-08T09:00:00Z", sections: 5 },
  { id: "4", title: "Deployment Report — v2.4.0 Release", type: "deployment", createdAt: "2024-01-05T18:00:00Z", sections: 4 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">AI-generated system health and incident reports</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      <div className="grid gap-4">
        {MOCK_REPORTS.map((report) => (
          <div key={report.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-6 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-accent p-3">
                <FileBarChart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{report.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="outline">{report.type}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="text-xs text-muted-foreground">{report.sections} sections</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
