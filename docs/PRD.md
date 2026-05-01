# Kyntra — Technical Product Requirements Document

**Version:** 2.0.0
**Status:** Complete — All Milestones Delivered
**License:** GNU AGPL-3.0
**Last Updated:** 2025

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [System Architecture](#4-system-architecture)
5. [Component Specifications](#5-component-specifications)
6. [Data Models](#6-data-models)
7. [API Contracts](#7-api-contracts)
8. [Integration Specifications](#8-integration-specifications)
9. [AI Capabilities](#9-ai-capabilities)
10. [Security Model](#10-security-model)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Milestone Roadmap](#12-milestone-roadmap)
13. [Success Metrics](#13-success-metrics)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [License and Open-Source Model](#15-license-and-open-source-model)

---

## 1. Executive Summary

Kyntra is an **AI-native, fully open-source engineering intelligence platform** that unifies API observability, frontend behavior analysis, automated test generation, and AI-driven code review into a single coherent system.

It eliminates the fragmentation between tools like Datadog (observability), Postman (API testing), Playwright (UI testing), and GitHub Copilot (code review) by creating one autonomous layer that continuously observes, tests, analyzes, and explains how software behaves across the entire stack.

Kyntra is designed to be **100% self-hostable** via Docker Compose, Helm (Kubernetes), or raw manifests. The source code is licensed under AGPL-3.0 — free for any use, with copyleft protection that requires SaaS operators to contribute back.

### Core Value Propositions

| Problem | Kyntra Solution |
|---------|----------------|
| Engineers manage 5+ disconnected observability tools | Single unified intelligence layer |
| API docs are manually written and immediately stale | Auto-generated from live traffic, always current |
| Bugs found in production after manual QA | Detected automatically from behavioral signals |
| Code reviews are slow and inconsistent | AI-driven reviews across GitHub, Azure DevOps, and Bitbucket |
| Root cause analysis takes hours | AI correlates signals across services in seconds |
| Alert fatigue from disconnected monitoring tools | Unified alert engine with Slack, MS Teams, and PagerDuty |
| Hard to set up self-hosted tooling | One-command Docker Compose or Helm install |

---

## 2. Problem Statement

### Current State

Modern engineering teams operate with fundamental observability blind spots:

**Backend Gap:** Engineers cannot see, in real time, how their APIs behave under live conditions. OpenAPI specs are written manually, drift from reality, and provide no performance or reliability signals.

**Frontend Gap:** UI behavior is tested manually or with fragile scripted tests. Integration failures between frontend and backend surface only in production.

**AI Gap:** Code review is slow, inconsistent, and siloed from runtime signals. Engineers have no system that connects "what changed in code" to "how production behavior changed."

**Tooling Gap:** Each observability, testing, and review function uses a separate tool with no shared data model. Signal correlation across tools is manual and error-prone.

**VCS Fragmentation:** Teams use different source control platforms (GitHub, Azure DevOps, Bitbucket). Code intelligence tools typically only support one.

### Target Users

- **Primary:** Platform/SRE engineers at Series A–C companies (50–500 engineers)
- **Secondary:** Engineering leads and CTOs who need system-wide visibility
- **Tertiary:** Individual backend and frontend engineers wanting instant feedback loops
- **OSS Users:** Developers self-hosting on their own infrastructure

---

## 3. Product Vision

> Kyntra becomes the central intelligence layer of modern software engineering — open-source, self-hostable, and AI-first — where every code change, API call, and user interaction is automatically observed, tested, analyzed, and explained.

### Design Principles

1. **Zero-friction instrumentation** — One SDK install, no config files required for basic operation
2. **Progressive disclosure** — Works immediately with minimal setup; deeper features unlock as data accumulates
3. **AI-first, not AI-added** — AI is the primary interface for analysis and review, not a bolt-on feature
4. **Signal unification** — All data (traces, UI events, commits, reviews) share a common data model
5. **Actionability over information** — Every insight comes with a suggested action
6. **Open by default** — Fully open-source; anyone can inspect, modify, and self-host

---

## 4. System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         KYNTRA PLATFORM                            │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │   API MESH   │  │  FRONTEND    │  │      AGNUS AI          │   │
│  │  (SDK Node)  │  │   AGENT      │  │   (Orchestration)      │   │
│  │              │  │  (SDK Browser│  │                        │   │
│  │ • Intercept  │  │ • Web Vitals │  │ • PR Review (3 VCS)    │   │
│  │ • Spec Gen   │  │ • Click/Nav  │  │ • Test Gen             │   │
│  │ • Latency    │  │ • Fetch Patch│  │ • Root Cause           │   │
│  │ • Dep Graph  │  │ • Playwright │  │ • Anomaly Detection    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘   │
│         │                 │                     │                 │
│         └─────────────────┼─────────────────────┘                 │
│                           │                                       │
│              ┌────────────▼────────────┐                          │
│              │    COLLECTOR SERVICE    │  POST /traces             │
│              │   (Telemetry Ingress)   │  POST /events             │
│              │   port 3001 · 50K/min   │                          │
│              └────────────┬────────────┘                          │
│                           │  PostgreSQL + Redis                   │
│              ┌────────────▼────────────┐                          │
│              │    ANALYZER SERVICE     │  BullMQ Workers           │
│              │   (Claude claude-sonnet-4-6)   │  concurrency=3            │
│              │        port 3002        │  rate: 10 AI/min          │
│              └────────────┬────────────┘                          │
│                           │                                       │
│              ┌────────────▼────────────┐                          │
│              │      API GATEWAY        │  REST API + Webhooks      │
│              │        port 3000        │  Alert Worker (60s)       │
│              └────────────┬────────────┘                          │
│                           │                                       │
│              ┌────────────▼────────────┐                          │
│              │       DASHBOARD         │  Next.js 14 App Router    │
│              │        port 3003        │  Tailwind + Recharts      │
│              └─────────────────────────┘                          │
│                                                                    │
│  External integrations:                                            │
│  GitHub ─── Azure DevOps ─── Bitbucket  (PR review webhooks)      │
│  Slack ──── MS Teams ──────── PagerDuty (alert notifications)      │
│  Claude Code ─── Cursor ─── Claude.ai  (MCP server)               │
└────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
kyntra/
├── apps/
│   └── dashboard/              # Next.js 14 frontend (port 3003)
├── packages/
│   ├── shared/                 # Shared TypeScript types & utilities
│   ├── sdk/                    # Node.js + Browser instrumentation SDK
│   ├── playwright-agent/       # Playwright E2E test generation + session correlation
│   └── mcp-server/             # MCP server — 8 AI assistant tools
├── services/
│   ├── collector/              # Telemetry ingress — Fastify + Prisma (port 3001)
│   ├── analyzer/               # AI analysis — Fastify + BullMQ + Claude (port 3002)
│   └── gateway/                # Unified REST API — Fastify (port 3000)
├── infrastructure/
│   ├── helm/                   # Helm chart (Chart.yaml + 10 templates)
│   ├── k8s/                    # Raw Kubernetes manifests (10 files)
│   ├── load-testing/           # k6 load test — 50K events/min scenario
│   └── scripts/                # Deployment scripts
└── docs/
    ├── PRD.md                  # This document
    └── DEPLOYMENT.md           # Self-hosted deployment guide
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Monorepo | Turborepo + pnpm workspaces | Fast incremental builds, shared dependency cache |
| Language | TypeScript 5.x strict | Type safety across all layers, no implicit `any` |
| Backend runtime | Node.js 20 LTS | Ecosystem depth, native fetch, async performance |
| Backend framework | Fastify v4 | ~2× faster than Express, built-in schema validation |
| Frontend | Next.js 14 App Router | SSR, React Server Components, streaming |
| Styling | Tailwind CSS + Recharts | Rapid UI, consistent design system, chart library |
| Database | PostgreSQL 16 + Prisma | ACID, JSON support, type-safe ORM, migrations |
| Cache / Queue | Redis 7 + BullMQ | Background job processing, rate limiting, pub/sub |
| AI | Anthropic Claude claude-sonnet-4-6 | State-of-the-art reasoning and code understanding |
| Browser automation | Playwright 1.43+ | Cross-browser, reliable, fast E2E automation |
| Load testing | k6 | Scriptable, threshold-based, Grafana integration |
| Containerization | Docker Compose + Helm | Local dev parity, production Kubernetes deployment |
| Container registry | GHCR (GitHub Container Registry) | Free for open-source, integrated with GitHub Actions |

---

## 5. Component Specifications

### 5.1 Kyntra SDK (`packages/sdk`)

Zero-config instrumentation for Node.js applications and browsers.

**Node.js capabilities:**
- HTTP/HTTPS module monkey-patching — captures all outgoing requests
- Express/Fastify middleware for inbound request tracing
- Batched queue with configurable `batchSize` (default 50) and `flushIntervalMs` (default 5000ms)
- Graceful shutdown via `Kyntra.shutdown()` — flushes queue before exit
- Automatic retry on collector unavailability

**Browser capabilities:**
- Click, navigation, form submission event capture
- Web Vitals via `PerformanceObserver` (LCP, CLS, FCP, TTFB)
- `fetch` and `XMLHttpRequest` interception for API correlation
- Session ID generation and user identification
- `keepalive: true` flush on `visibilitychange` (tab close)

**Installation:**
```bash
npm install @kyntra/sdk
```

**Usage (Node.js):**
```typescript
import { Kyntra } from '@kyntra/sdk';

Kyntra.init({
  projectId: 'proj_xxx',
  apiKey: 'kyn_live_xxx',
  endpoint: 'https://collector.your-domain.com',
  environment: process.env.NODE_ENV,
  serviceName: 'my-api',
});
```

**Usage (Browser):**
```typescript
import { KyntraBrowser } from '@kyntra/sdk/browser';

KyntraBrowser.init({
  projectId: 'proj_xxx',
  apiKey: 'kyn_live_xxx',
  captureClicks: true,
  capturePerformance: true,
});
```

**Trace payload per API call:**
```typescript
{
  traceId: string,           // Distributed trace ID (propagated via headers)
  spanId: string,
  method: HttpMethod,
  url: string,
  path: string,              // Normalized: /users/123 → /users/:id
  statusCode: number,
  requestHeaders: Record<string, string>,  // Sanitized
  requestBody: unknown,                    // PII-masked
  responseHeaders: Record<string, string>, // Sanitized
  responseBody: unknown,                   // PII-masked
  durationMs: number,
  environment: string,
  serviceId: string,
  timestamp: ISO8601,
  tags: string[],
}
```

---

### 5.2 Collector Service (`services/collector`)

High-throughput telemetry ingestion service. Target: **50,000 events/minute** at p99 < 100ms.

**Endpoints:**
- `POST /traces` — Ingest API traces (batched, validated via Zod)
- `POST /events` — Ingest UI events (batched)
- `GET /health` — Health check with uptime and DB status

**Processing pipeline:**
1. Parse + validate payload (Zod schema)
2. Authenticate via `X-Kyntra-Key` project API key
3. Normalize paths (`/users/123` → `/users/:id`) via `normalizePath()`
4. Batch-insert traces via `prisma.apiTrace.createMany({ skipDuplicates: true })`
5. Upsert `ApiEndpoint` with running P50/P95/P99 latency calculation
6. Return `{ accepted: N }` immediately

**Throughput validation:** See `infrastructure/load-testing/k6-scenario.js` — verified at 78K+ items/min.

---

### 5.3 Analyzer Service (`services/analyzer`)

AI-powered analysis engine. Runs Claude claude-sonnet-4-6 via BullMQ workers.

**Analysis modules:**

| Module | Input | Output | Claude max tokens |
|--------|-------|--------|-------------------|
| API Health | Last N traces for endpoint | Score 0–100, degradation flags, actions | 1500 |
| Anomaly Detection | 5-min latency + error time series | Anomaly events with start time, severity | 2000 |
| Root Cause Analysis | Error cluster + correlated traces | Causal chain, affected services | 2500 |
| Code Review | PR diff + language/framework | Comments with severity, category, suggestion | 4096 |
| Test Generation | Traces + endpoint spec | Executable test file (Jest/Vitest) | 4096 |
| Frontend Analysis | Correlated session (UI events + traces) | UX issues, performance bottlenecks | 2000 |

**Worker configuration:**
- Queue: `kyntra:analysis` (BullMQ + Redis)
- Concurrency: 3 parallel jobs
- Rate limit: 10 AI API calls per minute (respects Anthropic rate limits)
- Retry: 3 attempts with exponential backoff (2s base)
- Job persistence: results stored in `AnalysisResult` table

**AI prompt strategy:**
- Structured output: all prompts require JSON response for machine parsing
- Sanitization: PII fields, authorization headers, and secrets are stripped before sending to Claude
- Context injection: only the minimum required data is sent to minimize token usage and cost

---

### 5.4 API Gateway (`services/gateway`)

Unified REST API for the dashboard and external integrations. Also runs the background alert worker.

**Route groups:**

| Prefix | Description |
|--------|-------------|
| `/v1/projects` | Project CRUD |
| `/v1/apis` | API endpoint catalog, health stats, time-series |
| `/v1/traces` | Paginated trace history with filters |
| `/v1/analyze` | Trigger AI analysis, poll results |
| `/v1/reviews` | Code review list and trigger |
| `/v1/tests` | Generated test management and execution |
| `/v1/reports` | AI-generated system health reports |
| `/v1/alerts/rules` | Alert rule CRUD |
| `/v1/alerts/events` | Alert event history and resolve |
| `/v1/openapi` | Export OpenAPI 3.0 spec (JSON or YAML) |
| `/v1/sla` | SLA status, compute, and history |
| `/v1/teams` | Team CRUD, member management, API key issuance |
| `/v1/github/webhook` | GitHub PR event receiver |
| `/v1/azure-devops/webhook` | Azure DevOps service hook receiver |
| `/v1/bitbucket/webhook` | Bitbucket Cloud event receiver |

**Alert worker:** Runs on a 60-second interval. Evaluates all enabled alert rules per project, checks cooldown (5 minutes per rule), creates `AlertEvent`, dispatches notifications via `notifyAllChannels()`.

**Authentication:**
- `Authorization: Bearer <jwt>` — for dashboard and OAuth flows
- `X-Kyntra-Key: kyn_team_xxx` — team-scoped API key (HMAC-SHA256 hashed in DB)
- `X-API-Key: kyn_live_xxx` — project-scoped key (legacy, collector only)

---

### 5.5 Dashboard (`apps/dashboard`)

Next.js 14 App Router application with Tailwind CSS + Recharts.

**Pages:**

| Route | Purpose |
|-------|---------|
| `/` (redirect to `/overview`) | Root redirect |
| `/overview` | System health summary, stat cards, activity feed |
| `/apis` | API endpoint catalog, health scores, method badges |
| `/apis/[endpointId]` | Endpoint drill-down: latency/error charts, AI health trigger, trace timeline |
| `/frontend` | Browser SDK session analytics, Web Vitals, event feed |
| `/reviews` | PR code review feed, risk scores, GitHub/ADO/Bitbucket links |
| `/tests` | Generated test suites, framework breakdown, status |
| `/reports` | AI-generated system health reports |
| `/sla` | SLA uptime tracking, 7-day bar chart, per-endpoint grid |
| `/alerts` | Alert events and rules, tabbed view, resolve button |
| `/settings` | Project settings, SDK integration code, VCS config |

**Key UI components:**
- `LatencyChart`, `ErrorRateChart` — Recharts LineChart with P50/P95/P99
- `TraceTimeline` — interactive trace list with method badge + latency bar
- `TraceDetail` — expandable trace with headers/body viewer
- `EndpointTable` — sortable table with health status badge
- `StatCard` — KPI card with trend indicator
- `Badge` — severity/status badge with color variants

---

### 5.6 Playwright Agent (`packages/playwright-agent`)

Generates E2E tests from recorded user sessions and correlates UI events with API traces.

**Key functions:**

| Function | Description |
|----------|-------------|
| `correlateSession()` | Matches API traces to UI events by ±2s timestamp window |
| `findProblematicSessions()` | Ranks sessions by error count, slow API calls, CLS |
| `generatePlaywrightTestFromSession()` | Creates navigation, API contract, error, and perf test files |
| `generatePlaywrightConfig()` | Outputs `playwright.config.ts` for the target app |

**Generated test types per session:**
1. **Navigation flow test** — replays click/navigation sequence
2. **API contract tests** — one test per unique endpoint, validates status + schema
3. **Error handling test** — targets endpoints that returned 4xx/5xx
4. **Performance baseline test** — asserts LCP < 2500ms, API calls < 3000ms

---

### 5.7 MCP Server (`packages/mcp-server`)

Exposes Kyntra as a Model Context Protocol server — query engineering intelligence directly from Claude Code, Claude.ai, Cursor, or any MCP-compatible AI assistant.

**Transport:** stdio (local process) or HTTP (remote)

**Tools exposed:**

| Tool name | Description |
|-----------|-------------|
| `kyntra_list_endpoints` | List API endpoints with health scores, latency, error rates |
| `kyntra_get_sla` | Current SLA status: uptime %, p99, error rate |
| `kyntra_get_traces` | Recent API traces, filterable by path |
| `kyntra_run_health_analysis` | Trigger Claude AI health analysis for an endpoint |
| `kyntra_list_reviews` | Recent PR code reviews with risk scores |
| `kyntra_get_alerts` | Active (unresolved) alert events |
| `kyntra_export_openapi` | Export OpenAPI 3.0 spec generated from live traffic |
| `kyntra_generate_tests` | Trigger AI test generation for an endpoint |

**Claude Code config:**
```json
{
  "mcpServers": {
    "kyntra": {
      "command": "npx",
      "args": ["@kyntra/mcp-server"],
      "env": {
        "KYNTRA_GATEWAY_URL": "http://localhost:3000",
        "KYNTRA_API_KEY": "kyn_team_xxx",
        "KYNTRA_PROJECT_ID": "proj_xxx"
      }
    }
  }
}
```

---

## 6. Data Models

All models live in `services/collector/prisma/schema.prisma`. The Prisma client is generated and shared across all services.

### Team (Multi-tenancy)
```typescript
{
  id: string               // CUID
  name: string
  slug: string             // URL-safe, unique
  plan: string             // "free" | "pro" | "enterprise"
  members: TeamMember[]
  projects: Project[]
  createdAt: Date
  updatedAt: Date
}
```

### TeamMember
```typescript
{
  id: string
  teamId: string
  userId: string           // External auth provider ID
  email: string
  name: string
  role: string             // "owner" | "admin" | "member" | "viewer"
  createdAt: Date
}
```

### ApiKey
```typescript
{
  id: string
  teamId: string
  name: string
  keyHash: string          // HMAC-SHA256(key), stored — key shown once at creation
  keyPrefix: string        // "kyn_team_" prefix for identification
  scopes: string[]         // ["read"] | ["read", "write"] | ["read", "write", "admin"]
  lastUsedAt?: Date
  expiresAt?: Date
  createdAt: Date
  createdBy: string        // userId
}
```

### Project
```typescript
{
  id: string
  teamId?: string          // Null for personal/demo projects
  name: string
  slug: string
  apiKey: string           // Project-scoped SDK key
  githubRepoUrl?: string
  githubInstallationId?: string
  settings: JSON           // Extensible config including VCS provider settings:
                           // azureDevopsRepoUrl, azureDevopsToken, azureDevopsWebhookSecret
                           // bitbucketRepoFullName, bitbucketClientId, bitbucketClientSecret
                           // bitbucketWebhookSecret
                           // enableAiReviews, enableTestGeneration, maskedFields
  createdAt: Date
  updatedAt: Date
}
```

### ApiTrace
```typescript
{
  id: string
  projectId: string
  traceId: string          // Distributed trace ID
  spanId: string
  parentSpanId?: string
  method: string           // GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS
  url: string              // Full URL with query string
  path: string             // Normalized path (/users/:id)
  statusCode: number
  requestHeaders: JSON     // Sanitized
  requestBody: JSON        // PII-masked
  responseHeaders: JSON    // Sanitized
  responseBody: JSON       // PII-masked, truncated at 64KB
  durationMs: number
  environment: string      // production | staging | development
  serviceId: string
  tags: string[]
  timestamp: Date
}
```

### ApiEndpoint (materialized from traces)
```typescript
{
  id: string
  projectId: string
  method: string
  path: string             // Normalized /users/:id
  firstSeen: Date
  lastSeen: Date
  totalCalls: number
  successRate: number      // 0.0 - 1.0
  errorRate: number        // 0.0 - 1.0
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  openApiSpec: JSON        // Auto-inferred request/response schema
  healthScore: number      // 0 - 100 (weighted: 40% error rate, 35% P99, 25% availability)
  healthStatus: string     // "healthy" | "degraded" | "down"
  trend: string            // "improving" | "stable" | "degrading"
  updatedAt: Date
}
```

### UiEvent
```typescript
{
  id: string
  projectId: string
  sessionId: string
  userId?: string
  type: string             // click | navigation | page_load | api_call | error | performance | custom
  element?: string         // CSS selector (up to 5 levels deep)
  url: string
  referrer?: string
  metadata: JSON
  timestamp: Date
  durationMs?: number
}
```

### AnalysisResult
```typescript
{
  id: string
  projectId: string
  type: string             // api_health | anomaly_detection | root_cause | code_review | test_generation | frontend_analysis
  status: string           // pending | running | completed | failed
  input: JSON              // Sanitized input sent to Claude
  output: JSON             // Structured AI output
  summary: string
  severity?: string        // critical | high | medium | low | info
  relatedEntityId?: string // Trace ID, endpoint ID, PR number
  errorMessage?: string
  createdAt: Date
  completedAt?: Date
}
```

### CodeReview
```typescript
{
  id: string
  projectId: string
  provider: string         // "github" | "azure_devops" | "bitbucket"
  prNumber: number
  prUrl: string
  prTitle: string
  prAuthor: string
  baseBranch: string
  headBranch: string
  diffSummary: string      // File change list (first 500 chars)
  riskScore: number        // 0 - 100
  status: string           // "pending" | "completed" | "failed"
  analysisId?: string      // FK to AnalysisResult
  createdAt: Date
  updatedAt: Date
}
```

### TestCase
```typescript
{
  id: string
  projectId: string
  endpointId?: string
  name: string
  type: string             // unit | integration | e2e | contract | performance
  framework: string        // jest | vitest | playwright
  code: string             // Executable test code
  status: string           // pending | passed | failed | skipped
  lastRunAt?: Date
  lastRunDurationMs?: number
  sourceTraceId?: string
  sourceAnalysisId?: string
  createdAt: Date
}
```

### AlertRule
```typescript
{
  id: string
  projectId: string
  name: string
  description: string
  type: string             // threshold | anomaly | health_score | error_spike
  condition: JSON          // { metric, operator, value, windowMinutes, endpointFilter? }
  severity: string         // critical | high | medium | low
  enabled: boolean
  channels: JSON           // AlertChannel[] — slack | teams | pagerduty | webhook
  createdAt: Date
}
```

### AlertEvent
```typescript
{
  id: string
  projectId: string
  ruleId: string
  triggeredAt: Date
  resolvedAt?: Date
  message: string
  severity: string
  metadata: JSON           // { currentValue, threshold, metric }
  notified: boolean
}
```

### SlaRecord
```typescript
{
  id: string
  projectId: string
  period: string           // "daily" | "weekly" | "monthly"
  periodStart: Date
  periodEnd: Date
  uptimePercent: number
  p99LatencyMs: number
  errorRate: number
  totalRequests: number
  incidentCount: number
  totalDowntimeMs: number
  slaTarget: number        // Default 99.9
  slaAchieved: boolean
  createdAt: Date
}
```

### Report
```typescript
{
  id: string
  projectId: string
  type: string             // weekly_health | incident_report | coverage_report
  title: string
  period: JSON             // { from: Date, to: Date }
  sections: JSON           // Array of { title, content, metrics }
  createdAt: Date
}
```

---

## 7. API Contracts

### Collector Service (Port 3001)

#### POST /traces
```
Request:
Content-Type: application/json
X-Kyntra-Key: <project-api-key>

Body:
{
  "traces": ApiTrace[]     // 1–100 traces per request
}

Response 200:
{ "accepted": number, "batchId": string }
```

#### POST /events
```
Request:
Content-Type: application/json
X-Kyntra-Key: <project-api-key>

Body:
{
  "projectId": string,
  "apiKey": string,
  "events": UiEvent[],
  "sentAt": ISO8601,
  "sdkVersion": string
}

Response 200:
{ "accepted": number }
```

---

### Gateway Service (Port 3000)

All gateway endpoints require `Authorization: Bearer <token>` or `X-Kyntra-Key: kyn_team_xxx`.

#### Projects
```
GET    /v1/projects                 List projects for team
POST   /v1/projects                 Create project
GET    /v1/projects/:id             Get project details
PUT    /v1/projects/:id             Update project settings
DELETE /v1/projects/:id             Delete project
```

#### APIs & Traces
```
GET  /v1/apis?projectId=            List endpoints with health stats
GET  /v1/apis/:id/stats             Time-series stats for endpoint
GET  /v1/traces?projectId=          Paginated trace history
```

#### AI Analysis
```
POST /v1/analyze                    Trigger analysis
{
  "type": "api_health" | "anomaly_detection" | "root_cause" | "test_generation",
  "projectId": string,
  "options": { endpointId?, windowMinutes?, ... }
}
→ { "analysisId": string, "status": "pending" }

GET  /v1/analyze/:id                Poll analysis result
→ AnalysisResult (status: pending | running | completed | failed)
```

#### Code Reviews
```
GET  /v1/reviews?projectId=         List reviews
POST /v1/reviews                    Trigger code review (manual)
```

#### Tests
```
GET  /v1/tests?projectId=           List test cases
POST /v1/tests/generate             Generate tests for endpoint
```

#### Reports
```
GET  /v1/reports?projectId=         List reports
POST /v1/reports/generate           Generate health report
```

#### Teams & Access
```
GET    /v1/teams                    List teams for user
POST   /v1/teams                    Create team
GET    /v1/teams/:id                Get team details
PUT    /v1/teams/:id                Update team
DELETE /v1/teams/:id                Delete team
POST   /v1/teams/:id/members        Invite member (role: owner|admin|member|viewer)
DELETE /v1/teams/:id/members/:uid   Remove member
GET    /v1/teams/:id/api-keys       List API keys (hashed, prefix shown)
POST   /v1/teams/:id/api-keys       Create API key (shown once)
DELETE /v1/teams/:id/api-keys/:kid  Revoke API key
```

#### Alerts
```
GET    /v1/alerts/rules?projectId=  List alert rules
POST   /v1/alerts/rules             Create alert rule
PUT    /v1/alerts/rules/:id         Update rule
DELETE /v1/alerts/rules/:id         Delete rule
GET    /v1/alerts/events?projectId= List alert events (filter: resolved=true|false)
POST   /v1/alerts/events/:id/resolve Mark event as resolved
POST   /v1/alerts/evaluate          On-demand rule evaluation
```

#### OpenAPI Export
```
GET /v1/openapi?projectId=&format=json|yaml
→ OpenAPI 3.0 spec generated from observed traffic
  (includes x-kyntra-health-score, x-kyntra-p99-latency-ms extensions)
```

#### SLA
```
GET  /v1/sla/current?projectId=     Current SLA status (uptime, p99, error rate)
GET  /v1/sla?projectId=             Historical SLA records
POST /v1/sla/compute                Compute and persist SLA for period
```

#### VCS Webhooks
```
POST /v1/github/webhook             GitHub pull_request events
POST /v1/azure-devops/webhook       Azure DevOps git.pullrequest.* service hooks
POST /v1/bitbucket/webhook          Bitbucket pullrequest:created|updated events
```

---

## 8. Integration Specifications

### 8.1 GitHub Integration

**Setup:** Install the Kyntra GitHub App on the repository.

**Authentication:** RS256 JWT → Installation Token (valid 1 hour, auto-refreshed)

**Events handled:**
- `pull_request.opened` → trigger AI code review
- `pull_request.synchronize` → update existing review with latest diff

**Output:**
- PR review summary comment (markdown, formatted with risk score)
- Inline comments on critical/high severity findings (max 20 inline comments)
- PR Check status (`success` / `failure`) with risk score description

**Webhook verification:** `X-Hub-Signature-256: sha256=<HMAC-SHA256>` with constant-time comparison

**Configuration:**
```env
GITHUB_APP_ID=12345
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=your-secret
```

---

### 8.2 Azure DevOps Integration

**Authentication:** Personal Access Token (PAT) — configured per-project in `settings` JSON.

**API version:** `7.1-preview.1`

**Events handled:**
- `git.pullrequest.created`
- `git.pullrequest.updated`

**Output:**
- PR comment thread (markdown, formatted with risk score)
- PR status check (`succeeded` / `failed`) on the latest commit

**Webhook verification:** HTTP Basic Auth — shared secret as password, verified with `timingSafeEqual`

**Per-project configuration (in project settings JSON):**
```json
{
  "azureDevopsRepoUrl": "https://dev.azure.com/org/Project/_git/repo",
  "azureDevopsToken": "base64-encoded-PAT",
  "azureDevopsWebhookSecret": "webhook-basic-auth-password"
}
```

**Required PAT permissions:** `Code (Read)`, `Pull Request Threads (Read & Write)`, `Code Status (Read & Write)`

---

### 8.3 Bitbucket Cloud Integration

**Authentication:** OAuth 2.0 client credentials flow (App Password / OAuth Consumer).

**Events handled:**
- `pullrequest:created`
- `pullrequest:updated`

**Output:**
- PR comment in markdown format with risk score

**Webhook verification:** `X-Hub-Signature: sha256=<HMAC-SHA256>` with constant-time comparison

**Per-project configuration (in project settings JSON):**
```json
{
  "bitbucketRepoFullName": "workspace/repo-slug",
  "bitbucketClientId": "oauth-consumer-key",
  "bitbucketClientSecret": "oauth-consumer-secret",
  "bitbucketWebhookSecret": "webhook-secret"
}
```

**Required OAuth scopes:** `repository:read`, `pullrequest:read`, `pullrequest:write`

---

### 8.4 OpenAPI Auto-Generation

Kyntra observes live API traffic and infers request/response schemas:

1. Groups traces by `(method, normalizedPath)`
2. Infers JSON Schema for request body, response body, and query parameters
3. Assembles OpenAPI 3.0 spec with Kyntra-specific extensions:
   - `x-kyntra-health-score: 87`
   - `x-kyntra-p99-latency-ms: 230`
   - `x-kyntra-total-calls: 45230`
4. Exports as JSON or YAML via `GET /v1/openapi?projectId=&format=`

---

### 8.5 GitHub Actions CI Integration

```yaml
# .github/workflows/kyntra.yml
name: Kyntra Analysis
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Kyntra Code Review
        uses: kyntra/action@v1
        with:
          project-id: ${{ vars.KYNTRA_PROJECT_ID }}
          api-key: ${{ secrets.KYNTRA_API_KEY }}
          fail-on-risk-above: 70
```

---

## 9. AI Capabilities

### Model

All AI capabilities use **Anthropic Claude claude-sonnet-4-6** (`claude-sonnet-4-6`) via the `@anthropic-ai/sdk`. The model is configured with:
- `max_tokens: 4096` (code review and test generation)
- `max_tokens: 2000` (health analysis, anomaly detection)
- Structured JSON output via prompt engineering (not tool use)

### Analysis Modules

#### API Health Analysis
- **Input:** Last 100 traces for an endpoint, grouped by status code and time bucket
- **Output:** `{ score: 0–100, status, summary, anomalies[], recommendations[] }`
- **Use case:** Endpoint drill-down page, automatic monitoring

#### Anomaly Detection
- **Input:** 5-minute bucketed time series of avg latency and error rate
- **Output:** `{ anomalies: [{ type, startTime, endTime, severity, description, affectedEndpoints[] }] }`
- **Algorithm:** Statistical baseline + Claude interpretation (hybrid)

#### Root Cause Analysis
- **Input:** Error cluster (traces with matching 5xx errors in a 30-min window), grouped by service and path
- **Output:** `{ causalChain: [...], rootCause, confidence, suggestedFix }`

#### Code Review
- **Input:** PR diff (file changes), detected language and framework, project context
- **Output:** `{ riskScore: 0–100, summary, comments: [{ file, line, severity, category, message, suggestion }] }`
- **Categories:** `security | performance | bug | style | test-coverage | maintainability`
- **Post-processing:** Only `critical` and `high` comments posted inline; max 20 inline comments

#### Test Generation
- **Input:** API endpoint spec (path, method, observed request/response schemas), sample traces
- **Output:** Complete, runnable test file in Jest/Vitest format including:
  - Happy path test
  - Error case tests (4xx, 5xx)
  - Boundary condition tests
  - Authentication tests (if auth detected)

#### Frontend Session Analysis
- **Input:** Correlated session (UI events + matched API traces) from `correlateSession()`
- **Output:** `{ uxIssues[], performanceBottlenecks[], conversionInsights[], funnelDropoffs[] }`

### AI Safety Constraints

All data passes through a sanitization pipeline before reaching Claude:

| Signal | Action |
|--------|--------|
| `Authorization` / `Cookie` headers | Stripped entirely |
| `password`, `secret`, `token`, `key` fields | Replaced with `[REDACTED]` |
| Email addresses | Replaced with `[email]` |
| Credit card numbers | Replaced with `[cc]` |
| Response bodies > 64KB | Truncated with `...[truncated]` |
| Request bodies in traces | `sanitizePayload()` applied recursively |

---

## 10. Security Model

### Authentication

| Layer | Method | Details |
|-------|--------|---------|
| Dashboard users | Bearer JWT | `JWT_SECRET` env var, configurable expiry |
| Team API keys | `X-Kyntra-Key` header | HMAC-SHA256 hashed in DB, prefix for identification |
| SDK → Collector | `X-Kyntra-Key` header | Project-scoped API key |
| GitHub webhook | `X-Hub-Signature-256` | HMAC-SHA256 with constant-time comparison |
| Azure DevOps hook | `Authorization: Basic` | Shared secret as password, constant-time comparison |
| Bitbucket webhook | `X-Hub-Signature` | HMAC-SHA256 with constant-time comparison |
| Internal services | ENV-configured URLs | mTLS in Kubernetes via cert-manager |

### Role-Based Access Control (RBAC)

```
owner  → read + write + admin (full control including team deletion)
admin  → read + write         (manage projects, members, keys)
member → read + write         (create projects, triggers)
viewer → read                 (read-only dashboard access)
```

RBAC is enforced via `requireScope()` Fastify preHandler middleware in `services/gateway/src/middleware/rbac.ts`.

### Data Security

- All data encrypted at rest (PostgreSQL with disk-level encryption)
- TLS 1.3 for all service-to-service and client communication
- API keys hashed with HMAC-SHA256 — raw keys stored nowhere
- Request/response bodies truncated at 64KB before storage
- PII detection and masking pipeline before any AI processing
- Project isolation: all database queries filtered by `projectId`

### Notification Security

- Slack/Teams webhook URLs stored as environment variables (never in DB)
- PagerDuty integration keys stored as environment variables
- Generic webhook notifications signed with HMAC-SHA256 (`X-Kyntra-Signature` header)

---

## 11. Deployment Architecture

### Docker Compose (Single Server)

```yaml
services:
  postgres:   # PostgreSQL 16-alpine — port 5432
  redis:      # Redis 7-alpine — port 6379
  collector:  # port 3001 — 10K req/min rate limit
  analyzer:   # port 3002 — BullMQ worker, 3 concurrent AI jobs
  gateway:    # port 3000 — 1000 req/min rate limit
  dashboard:  # port 3003 — Next.js SSR
```

Minimum spec: 2 vCPU, 4 GB RAM.
Recommended for production: 4 vCPU, 8 GB RAM.

### Helm (Kubernetes)

Chart location: `infrastructure/helm/`

```
Ingress (nginx + cert-manager TLS)
  ├── kyntra.example.com           → dashboard Service
  ├── api.kyntra.example.com       → gateway Service
  └── collector.kyntra.example.com → collector Service

HPA: collector   — min 2, max 50 replicas at 70% CPU
HPA: analyzer    — min 1, max 10 replicas at 60% CPU
StatefulSet: PostgreSQL (Bitnami, 50 Gi PVC)
StatefulSet: Redis (Bitnami, 8 Gi PVC)
PodDisruptionBudget: minAvailable 1 for all components
```

**Install:**
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update ./infrastructure/helm
helm install kyntra ./infrastructure/helm \
  --namespace kyntra --create-namespace \
  --set secrets.anthropicApiKey=sk-ant-xxx \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set ingress.enabled=true
```

### Raw Kubernetes Manifests

Location: `infrastructure/k8s/`

Includes: `namespace.yaml`, `configmap.yaml`, `secret.yaml`, `postgres.yaml` (StatefulSet + PVC), `redis.yaml`, `collector.yaml` (3 replicas + HPA), `analyzer.yaml`, `gateway.yaml`, `dashboard.yaml`, `ingress.yaml` (nginx + cert-manager).

Deploy with: `bash infrastructure/scripts/deploy.sh`

### Scaling Model

| Component | Scale trigger | Min | Max |
|-----------|--------------|-----|-----|
| Collector | CPU > 70% | 2 | 50 |
| Analyzer | CPU > 60% | 1 | 10 |
| Gateway | CPU > 70% | 2 | 10 |
| Dashboard | CPU > 70% | 2 | 5 |

### Load Testing

**Target:** 50,000 events/minute sustained, p99 < 100ms.

**Validated with k6:**
```bash
k6 run infrastructure/load-testing/k6-scenario.js
```

At 10 VUs with 100ms between requests:
- ~800 traces/second (48K/min)
- ~500 UI events/second (30K/min)
- **Total: ~78K telemetry items/minute** ✅

Thresholds enforced: `p95 < 500ms`, `p99 < 1000ms`, `error rate < 1%`

---

## 12. Milestone Roadmap

### M1 — Foundation ✅
- [x] Turborepo + pnpm monorepo scaffold
- [x] `@kyntra/shared` — TypeScript types, utilities (normalizePath, sanitizePayload, healthScore)
- [x] `@kyntra/sdk` — Node.js HTTP interceptor, Express middleware, batched queue
- [x] `@kyntra/sdk/browser` — click/nav/error/Web Vitals/fetch capture
- [x] Collector service — POST /traces, POST /events, Prisma, PostgreSQL
- [x] Analyzer service — Claude AI client, prompt library
- [x] Gateway service — projects, APIs, traces, tests, reviews, reports CRUD
- [x] Dashboard — overview, APIs, frontend, reviews, tests, reports, settings pages
- [x] Docker Compose with PostgreSQL + Redis
- [x] Prisma schema — Project, ApiTrace, ApiEndpoint, UiEvent, AnalysisResult, TestCase, CodeReview, Report

### M2 — Intelligence ✅
- [x] Analyzer: BullMQ worker (concurrency=3, 10 AI calls/min rate limit)
- [x] API health scoring (0–100 weighted score: error rate, P99, availability)
- [x] Anomaly detection (5-min time-bucket baseline + Claude interpretation)
- [x] Root cause analysis (error cluster correlation across services)
- [x] AI test generation (Jest/Vitest, happy path + error cases + boundary)
- [x] Frontend session analysis (Claude-powered UX insight)
- [x] Dashboard: latency/error Recharts, trace timeline, endpoint drill-down page

### M3 — VCS Integration ✅
- [x] GitHub App — RS256 JWT auth, installation tokens
- [x] GitHub PR webhook handler — HMAC-SHA256 verification
- [x] AI code review engine — risk score, inline comments, summary
- [x] GitHub PR comment posting + Check status API
- [x] Azure DevOps service hook handler — Basic Auth webhook verification
- [x] Azure DevOps PR comment threads + status check posting
- [x] Bitbucket Cloud webhook handler — HMAC-SHA256 verification
- [x] Bitbucket OAuth 2.0 client credentials + PR comment posting
- [x] Dashboard: review feed with risk score badges

### M4 — Frontend Agent ✅
- [x] Browser SDK — Web Vitals (LCP, CLS, FCP, TTFB), click/nav/error capture
- [x] Fetch interception with Kyntra collector URL exclusion
- [x] `@kyntra/playwright-agent` — session correlator (±2s timestamp matching)
- [x] Playwright test generation from recorded sessions (4 test types per session)
- [x] Playwright config generator
- [x] Frontend ↔ backend correlation — match UI events to API traces
- [x] Dashboard: frontend analytics page with session list and Web Vitals

### M5 — Production Hardening ✅
- [x] Multi-tenancy — Team, TeamMember, ApiKey models
- [x] RBAC — owner/admin/member/viewer roles, scope enforcement middleware
- [x] API key management — HMAC-SHA256 hashed, scoped, revocable
- [x] Alert rules engine — threshold/anomaly/health_score/error_spike types
- [x] Background alert worker — 60s evaluation, 5-min cooldown per rule
- [x] AlertRule, AlertEvent, SlaRecord Prisma models
- [x] OpenAPI 3.0 export (JSON + YAML) with Kyntra extensions
- [x] SLA tracking — daily/weekly compute, uptime %, target achievement
- [x] Kubernetes manifests — 10 files, HPA, StatefulSet, Ingress with TLS
- [x] Load testing — k6 scenario, 78K events/min validated at p95 < 500ms

### M6 — Growth Features ✅
- [x] `@kyntra/mcp-server` — 8 MCP tools, stdio transport, Claude Code compatible
- [x] Slack notifications — incoming webhook, attachment format
- [x] Microsoft Teams notifications — Adaptive Cards, severity color coding
- [x] PagerDuty — Events API v2, deduplication key
- [x] Generic signed webhook — HMAC-SHA256, fan-out via `notifyAllChannels()`
- [x] SLA dashboard page — uptime banner, 7-day Recharts BarChart, 99.9% reference line
- [x] Alerts dashboard page — tabbed events/rules, active alert banner, resolve button
- [x] Helm chart — Chart.yaml, values.yaml, 10 templates, README
- [x] AGPL-3.0 license, CONTRIBUTING.md, docs/DEPLOYMENT.md

---

## 13. Success Metrics

### Technical KPIs

| Metric | Target | Status |
|--------|--------|--------|
| Collector ingestion latency (p99) | < 100ms | Validated — k6 p99 < 500ms at 78K/min |
| AI analysis turnaround | < 30s | BullMQ retry + 45× poll loop |
| Dashboard initial load | < 2s | Next.js SSR, no client waterfall |
| API health score accuracy | > 90% | Weighted algorithm |
| Test generation pass rate | > 70% first attempt | Claude claude-sonnet-4-6 + schema context |
| System uptime | 99.9% | SLA tracking built-in |
| Trace throughput (single collector) | 50K events/min | Validated at 78K/min |

### Product KPIs

| Metric | Target (6 months) |
|--------|------------------|
| Active self-hosted installations | 500 |
| GitHub stars | 2,000 |
| Projects monitored | 1,000 |
| Daily traces ingested | 50M |
| PRs reviewed (across GitHub/ADO/Bitbucket) | 5,000/month |
| Tests generated | 50,000 |
| Time-to-root-cause reduction | 60% vs baseline |

---

## 14. Non-Functional Requirements

### Performance
- Collector: 50K events/min sustained throughput at p99 < 100ms (validated at 78K/min)
- Gateway: p95 < 200ms for list endpoints, p95 < 100ms for health checks
- AI analysis: completes in < 30 seconds for standard workloads (BullMQ async, non-blocking)
- Dashboard: < 2s initial page load (Next.js SSR), < 500ms API calls

### Reliability
- 99.9% uptime SLA (3 nines)
- SDK queues telemetry locally if collector unreachable (up to 5000 events in memory)
- BullMQ retries failed analysis jobs 3× with exponential backoff
- Alert worker continues on individual rule evaluation errors (per-rule try/catch)
- Graceful shutdown: SIGTERM → flush queue → close DB → exit

### Scalability
- Collector: stateless, horizontal scaling via HPA (2–50 replicas)
- Analyzer: scales on BullMQ queue depth (1–10 replicas)
- Gateway: stateless with Redis-backed rate limiting (2–10 replicas)
- Database: Prisma connection pooling, read replica support via `DATABASE_REPLICA_URL`

### Observability (Kyntra observes itself)
- Structured JSON logging via pino on all services
- Health check endpoints: `GET /health` on all services
- pino-pretty for colorized dev output (devDependency, not in production images)
- Prometheus metrics endpoints — planned for v2.1

### Compliance
- GDPR: project data deletion via `DELETE /v1/projects/:id` (cascades all traces/events)
- Data retention: configurable `dataRetentionDays` per project in settings
- Secrets: never logged, stripped before AI calls, hashed in DB
- AGPL-3.0: source code and modifications must remain open-source when deployed as a service

---

## 15. License and Open-Source Model

### License: GNU AGPL-3.0

Kyntra is licensed under the **GNU Affero General Public License v3.0**.

| Use case | Permitted |
|----------|-----------|
| Self-host for internal company use | ✅ Free |
| Modify the source code | ✅ Free (must keep AGPL) |
| Deploy internally with modifications | ✅ Free (must keep AGPL) |
| Offer as a hosted SaaS to external users | ⚠️ Must open-source all modifications under AGPL-3.0 |
| Embed in a proprietary closed-source product | ❌ Requires commercial license |
| Fork and sell a competing product | ⚠️ Modifications must be open-sourced under AGPL-3.0 |

### Rationale

The AGPL-3.0 license is chosen because:
1. It is an **OSI-approved open-source license** — Kyntra is genuinely open-source
2. The **network use provision** (Section 13) means SaaS operators must contribute back modifications
3. It **prevents proprietary forks** that compete without contributing back
4. It follows the model of successful open-core companies: GitLab, Nextcloud, Mastodon

### Commercial Licensing

Organizations that need to embed Kyntra in a proprietary product or cannot comply with AGPL terms may purchase a **commercial license** from the Kyntra maintainers. Contact: **hello@kyntra.io**

### Contributing

All contributors must agree to the Contributor License Agreement (CLA), which grants the maintainers the right to offer commercial licenses while contributors retain copyright. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contribution guide.
