import { Key, Github, Bell, Database, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your Kyntra project</p>
      </div>

      {/* SDK Setup */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">SDK Installation</h2>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Install the Kyntra SDK in your Node.js application:</p>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            {`npm install @kyntra/sdk`}
          </pre>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Initialize at app startup:</p>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre">
{`import { Kyntra } from '@kyntra/sdk';

Kyntra.init({
  projectId: 'proj_demo',
  apiKey: 'kyn_live_xxxxxxxxxx',
  environment: process.env.NODE_ENV,
  serviceName: 'my-api',
});`}
          </pre>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Your API Key</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-mono">
              kyn_live_&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
            </code>
            <button className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
              Reveal
            </button>
            <button className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
              Rotate
            </button>
          </div>
        </div>
      </section>

      {/* GitHub Integration */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">GitHub Integration</h2>
          </div>
          <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">Not connected</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect your GitHub repository to enable AI-powered code reviews on every pull request.
        </p>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          <Github className="h-4 w-4" />
          Connect GitHub
        </button>
      </section>

      {/* Alert Thresholds */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Alert Thresholds</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Max Error Rate", value: "5", unit: "%" },
            { label: "P99 Latency Limit", value: "2000", unit: "ms" },
            { label: "Min Health Score", value: "70", unit: "/100" },
          ].map(({ label, value, unit }) => (
            <div key={label}>
              <label className="text-sm text-muted-foreground block mb-1">{label}</label>
              <div className="flex items-center">
                <input
                  type="number"
                  defaultValue={value}
                  className="h-9 w-full rounded-l-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="h-9 flex items-center rounded-r-lg border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  {unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          Save Thresholds
        </button>
      </section>

      {/* Data Retention */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Data Retention</h2>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Retain traces for</label>
            <div className="flex items-center">
              <input
                type="number"
                defaultValue={30}
                className="h-9 w-24 rounded-l-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="h-9 flex items-center rounded-r-lg border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                days
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
