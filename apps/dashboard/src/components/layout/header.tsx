"use client";

import { Bell, Search } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search endpoints, traces, reviews..."
            className="h-9 w-80 rounded-lg border border-input bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 hover:bg-accent">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">K</span>
          </div>
          <span className="text-sm text-muted-foreground">Demo Project</span>
        </div>
      </div>
    </header>
  );
}
