import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  iconColor?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  className,
  iconColor = "text-primary",
}: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="rounded-lg bg-accent p-2">
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        )}
      </div>

      {trend && trendValue && (
        <div className="mt-4 flex items-center gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" ? "text-green-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
          <span className="text-xs text-muted-foreground">vs last 24h</span>
        </div>
      )}
    </div>
  );
}
