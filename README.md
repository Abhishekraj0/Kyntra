# Kyntra

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

**AI-native full-stack engineering intelligence platform. Fully open-source.**

Kyntra unifies API observability, frontend behavior analysis, automated test generation, and AI-driven code review into a single autonomous system that continuously observes, tests, and explains your software.

Self-host it with **Docker Compose**, **Helm**, or raw **Kubernetes manifests**. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide.

---

## Architecture

```
kyntra/
├── apps/
│   └── dashboard/          # Next.js 14 — main UI
├── packages/
│   ├── shared/             # TypeScript types + utilities
│   ├── sdk/                # Node.js + Browser instrumentation SDK
│   ├── playwright-agent/   # Playwright E2E test generation
│   └── mcp-server/         # MCP server (Claude Code / AI assistant integration)
├── services/
│   ├── collector/          # Fastify — telemetry ingestion (port 3001)
│   ├── analyzer/           # Fastify + Claude AI — analysis engine (port 3002)
│   └── gateway/            # Fastify — unified REST API (port 3000)
├── infrastructure/
│   ├── helm/               # Helm chart for Kubernetes
│   ├── k8s/                # Raw Kubernetes manifests
│   └── load-testing/       # k6 load test (50K events/min)
└── docs/
    ├── PRD.md              # Full Technical PRD
    └── DEPLOYMENT.md       # Self-hosted deployment guide
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- PostgreSQL 16 (or use Docker)

### 1. Clone and install
```bash
git clone <repo>
cd kyntra
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Start infrastructure
```bash
pnpm docker:up         # Start PostgreSQL + Redis
pnpm db:migrate        # Run Prisma migrations
pnpm db:seed           # Seed demo project
```

### 4. Start all services
```bash
pnpm dev               # Start all services via Turborepo
```

Services start at:
- **Dashboard:** http://localhost:3003
- **Gateway API:** http://localhost:3000
- **Collector:** http://localhost:3001
- **Analyzer:** http://localhost:3002

---

## SDK Integration

Install in your Node.js application:

```bash
npm install @kyntra/sdk
```

```typescript
import { Kyntra } from '@kyntra/sdk';

// Initialize once at app startup
Kyntra.init({
  projectId: 'proj_xxx',
  apiKey: 'kyn_live_xxx',       // From Settings page
  environment: 'production',
  serviceName: 'my-api',
});

// All HTTP calls are automatically captured
// No other code changes required
```

### Express middleware (inbound tracing)
```typescript
import { kyntraMiddleware } from '@kyntra/sdk';
app.use(kyntraMiddleware());
```

### Browser SDK
```typescript
import { KyntraBrowser } from '@kyntra/sdk/browser';

KyntraBrowser.init({
  projectId: 'proj_xxx',
  apiKey: 'kyn_live_xxx',
});
```

---

## Core Features

### API Intelligence
- Auto-captures all HTTP requests/responses
- Normalizes URLs (`/users/123` → `/users/:id`)
- Tracks latency (P50/P95/P99), error rates, health scores
- Auto-generates OpenAPI specifications from live traffic

### AI Analysis (Claude claude-sonnet-4-6)
- **Health Analysis:** Score endpoints 0–100, detect degradation
- **Anomaly Detection:** Identify latency spikes and error surges
- **Root Cause Analysis:** Correlate signals across services
- **Code Review:** Risk scoring, security/bug/perf comments on PRs
- **Test Generation:** Complete, runnable test suites from traces

### Frontend Agent
- Captures clicks, navigation, form submissions, errors
- Web Vitals (LCP, FID, CLS, TTFB)
- Fetch/XHR interception for API correlation

### GitHub / Azure DevOps / Bitbucket Integration
- Webhook handler for pull request events across all three providers
- Auto-triggers AI code review on PR open/update
- Posts structured review comments + status checks back to the PR
- Zero-config: configure per-project via project settings JSON

---

## API Reference

All endpoints are served by the gateway at `http://localhost:3000`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/projects` | List projects |
| POST | `/v1/projects` | Create project |
| GET | `/v1/apis?projectId=` | API endpoint catalog |
| GET | `/v1/traces?projectId=` | Paginated trace history |
| GET | `/v1/apis/:id/stats` | Endpoint time-series stats |
| POST | `/v1/analyze` | Trigger AI analysis |
| GET | `/v1/analyze/:id` | Poll analysis result |
| GET | `/v1/reviews?projectId=` | Code review list |
| POST | `/v1/reviews` | Trigger code review |
| GET | `/v1/tests?projectId=` | Test case list |
| POST | `/v1/tests/generate` | Generate tests for endpoint |
| POST | `/v1/reports/generate` | Generate system health report |
| POST | `/v1/github/webhook` | GitHub webhook receiver |
| POST | `/v1/azure-devops/webhook` | Azure DevOps service hook receiver |
| POST | `/v1/bitbucket/webhook` | Bitbucket webhook receiver |
| GET | `/v1/teams` | List teams |
| POST | `/v1/teams` | Create team |
| POST | `/v1/teams/:id/members` | Invite member |
| POST | `/v1/teams/:id/api-keys` | Create API key |
| GET | `/v1/alerts/rules?projectId=` | Alert rules |
| POST | `/v1/alerts/rules` | Create alert rule |
| GET | `/v1/alerts/events?projectId=` | Alert event history |
| POST | `/v1/alerts/events/:id/resolve` | Resolve alert |
| GET | `/v1/openapi?projectId=` | Export OpenAPI 3.0 spec |
| GET | `/v1/sla/current?projectId=` | Current SLA status |
| POST | `/v1/sla/compute` | Compute SLA for period |

---

## Development

```bash
pnpm build             # Build all packages
pnpm typecheck         # TypeScript check all
pnpm test              # Run all tests
pnpm lint              # Lint all
pnpm db:studio         # Prisma Studio (DB browser)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript 5.x (strict) |
| Backend | Fastify v4 |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + Recharts |
| Database | PostgreSQL 16 + Prisma |
| Cache | Redis 7 |
| AI | Anthropic Claude claude-sonnet-4-6 |
| Browser testing | Playwright |
| Container | Docker Compose |

---

## Roadmap

- [x] M1 — SDK, Collector, Gateway, Dashboard skeleton
- [x] M1 — Shared types, AI analyzer architecture
- [x] M2 — Live AI health analysis + anomaly detection + BullMQ worker + trace viewer
- [x] M3 — GitHub App + PR review posting + AI code review engine
- [x] M4 — Playwright integration + UI test generation + frontend↔backend session correlation
- [x] M5 — Multi-tenancy (Teams/RBAC), alert rules engine, OpenAPI export, Kubernetes manifests
- [x] M6 — Kyntra MCP server (8 tools), Slack/PagerDuty notifications, SLA tracking

See [docs/PRD.md](docs/PRD.md) for the full Technical PRD.

---

## Self-Hosted Deployment

Kyntra is designed for easy self-hosting. See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the complete guide.

### Docker Compose (quickest)
```bash
cp .env.example .env   # Set ANTHROPIC_API_KEY + JWT_SECRET
docker compose up -d
docker compose exec collector pnpm prisma migrate deploy
```

### Helm (Kubernetes)
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update ./infrastructure/helm
helm install kyntra ./infrastructure/helm \
  --namespace kyntra --create-namespace \
  --set secrets.anthropicApiKey=sk-ant-xxx \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set ingress.enabled=true \
  --set "ingress.hosts[0].host=kyntra.example.com"
```

### Load Testing
```bash
# Verify 50K+ events/min throughput
brew install k6
k6 run infrastructure/load-testing/k6-scenario.js
```

---

## Notifications

Kyntra supports alert notifications to:
- **Slack** — incoming webhook
- **Microsoft Teams** — incoming webhook with Adaptive Cards
- **PagerDuty** — Events API v2
- **Generic webhook** — HMAC-signed HTTP POST

Configure channels per alert rule in the Alerts UI.

---

## License

Kyntra is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

- Free to self-host, modify, and use internally
- If you run a modified version as a hosted service, you must open-source your changes under AGPL-3.0
- For commercial/proprietary embedding, contact **hello@kyntra.io** for a commercial license

See [LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

Built with the Kyntra master system — ApiMesh + Frontend Agent + AgnusAI.
