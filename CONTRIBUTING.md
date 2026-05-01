# Contributing to Kyntra

Thank you for your interest in contributing to Kyntra — an open-source, AI-native engineering intelligence platform.

---

## License

Kyntra is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**What this means:**
- You are free to use, study, modify, and distribute Kyntra.
- If you run a **modified version as a network service** (SaaS), you must release your modifications under AGPL-3.0.
- If you want to **embed Kyntra in a proprietary product** without releasing your source code, you need a **commercial license** — contact the maintainers.

This model follows the pattern used by GitLab, Nextcloud, and similar open-core projects.

---

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- PostgreSQL 16 (or use Docker)

### 1. Clone and install
```bash
git clone https://github.com/kyntra/kyntra.git
cd kyntra
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — at minimum, set ANTHROPIC_API_KEY
```

### 3. Start infrastructure
```bash
pnpm docker:up     # Start PostgreSQL + Redis
pnpm db:migrate    # Run Prisma migrations
pnpm db:seed       # Seed demo project
```

### 4. Start all services
```bash
pnpm dev           # Turborepo starts all services concurrently
```

Services run at:
- **Dashboard:** http://localhost:3003
- **Gateway API:** http://localhost:3000
- **Collector:** http://localhost:3001
- **Analyzer:** http://localhost:3002

---

## Monorepo Structure

```
kyntra/
├── apps/
│   └── dashboard/          # Next.js 14 — main UI
├── packages/
│   ├── shared/             # TypeScript types + utilities
│   ├── sdk/                # Node.js + Browser instrumentation SDK
│   ├── playwright-agent/   # Playwright E2E test generation
│   └── mcp-server/         # MCP server for AI assistant integration
├── services/
│   ├── collector/          # Fastify — telemetry ingestion (port 3001)
│   ├── analyzer/           # Fastify + Claude AI — analysis engine (port 3002)
│   └── gateway/            # Fastify — unified REST API (port 3000)
├── infrastructure/
│   ├── helm/               # Helm chart for Kubernetes deployment
│   ├── k8s/                # Raw Kubernetes manifests
│   └── load-testing/       # k6 load test scripts
└── docs/
    ├── PRD.md              # Full Technical PRD
    └── DEPLOYMENT.md       # Self-hosted deployment guide
```

---

## Development Commands

```bash
pnpm build         # Build all packages (Turborepo)
pnpm typecheck     # TypeScript check all packages
pnpm test          # Run all tests
pnpm lint          # Lint all packages
pnpm db:studio     # Open Prisma Studio (DB browser)
pnpm db:migrate    # Run database migrations
```

---

## Code Style

- **TypeScript strict mode** — no implicit `any`, explicit return types on exported functions
- **No `eslint-disable`** without a documented reason
- **Prefer `unknown` over `any`** for external data; narrow with type guards
- **ESM-only** — all packages use `"type": "module"` and `.js` extensions in imports
- **Zod for runtime validation** at all service boundaries (HTTP request bodies)
- **No console.log in production** — use Fastify's `app.log` or the configured logger

### Import conventions
```typescript
// ✅ Correct — explicit .js extension for ESM
import { something } from "./utils.js";

// ✅ Correct — workspace packages
import { generateId } from "@kyntra/shared";

// ❌ Wrong — missing extension
import { something } from "./utils";
```

---

## Pull Request Process

1. **Fork** the repository and create a branch from `main`.
2. **One concern per PR** — don't mix features with refactors.
3. **Write tests** for new functionality.
4. **Run `pnpm typecheck` and `pnpm lint`** before opening a PR.
5. **Fill in the PR template** — describe what changed and why.
6. A maintainer will review within 48 hours.

---

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(scope): <short description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`

Examples:
```
feat(analyzer): add root cause analysis using Claude claude-sonnet-4-6
fix(collector): handle empty request body in traces endpoint
docs(helm): add production deployment examples
chore(deps): update bullmq to 5.5.0
```

---

## Adding a New VCS Integration

Kyntra supports GitHub, Azure DevOps, and Bitbucket. To add a new provider (e.g. GitLab):

1. **Create a service client** at `services/gateway/src/services/gitlab.ts`:
   - Webhook signature verification
   - PR/MR diff fetching
   - Comment posting function
   - Info extraction helper

2. **Create a route handler** at `services/gateway/src/routes/gitlab.ts`:
   - Register `POST /v1/gitlab/webhook`
   - Look up project via `settings.gitlabRepoUrl`
   - Background: fetch diff → trigger analyzer → poll → post comment

3. **Register the route** in `services/gateway/src/index.ts`.

4. **Update the Prisma schema** if you need new fields on `Project` or `CodeReview`.

5. **Document** the `settings` JSON fields your integration needs in `DEPLOYMENT.md`.

6. **Add to `TEAMS_WEBHOOK_URL` equivalent** in `notifications.ts` if the provider has a notification channel.

---

## Reporting Issues

Please use [GitHub Issues](https://github.com/kyntra/kyntra/issues) to report bugs or request features.

For security vulnerabilities, email **security@kyntra.io** directly rather than opening a public issue.
