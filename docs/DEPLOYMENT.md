# Kyntra — Self-Hosted Deployment Guide

Kyntra is fully open-source (AGPL-3.0) and designed for self-hosting. This guide covers all deployment options.

---

## Table of Contents

1. [Quick Start — Docker Compose](#docker-compose)
2. [Production — Kubernetes + Helm](#helm)
3. [Raw Kubernetes Manifests](#kubernetes)
4. [Environment Variables Reference](#environment-variables)
5. [VCS Integration Setup](#vcs-integrations)
6. [Notification Setup](#notifications)
7. [Database Migrations](#migrations)
8. [Upgrading](#upgrading)

---

## Docker Compose

The fastest way to run Kyntra on a single server.

### Requirements
- Docker Engine 24+
- Docker Compose v2+
- 4 GB RAM minimum (8 GB recommended for AI features)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/kyntra/kyntra.git
cd kyntra

# 2. Configure environment
cp .env.example .env
# Edit .env — required values:
#   ANTHROPIC_API_KEY=sk-ant-...
#   JWT_SECRET=$(openssl rand -hex 32)

# 3. Start all services
docker compose up -d

# 4. Run migrations (first time only)
docker compose exec collector pnpm prisma migrate deploy

# 5. Seed demo data (optional)
docker compose exec collector pnpm db:seed
```

Services start at:
| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3003 |
| Gateway API | http://localhost:3000 |
| Collector | http://localhost:3001 |
| Analyzer | http://localhost:3002 |

### With a reverse proxy (nginx/Caddy)

For production, put a reverse proxy in front:

```nginx
# nginx example
server {
    server_name kyntra.example.com;

    location / {
        proxy_pass http://localhost:3003;
    }
}

server {
    server_name api.kyntra.example.com;

    location / {
        proxy_pass http://localhost:3000;
    }
}

server {
    server_name collector.kyntra.example.com;

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

---

## Helm

For production Kubernetes deployments. Uses Bitnami charts for PostgreSQL and Redis.

### Prerequisites
- Kubernetes 1.25+
- Helm 3.10+
- `cert-manager` (for automatic TLS)

### Add Helm dependencies

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update ./infrastructure/helm
```

### Minimal install

```bash
helm install kyntra ./infrastructure/helm \
  --namespace kyntra \
  --create-namespace \
  --set secrets.anthropicApiKey=sk-ant-xxx \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=kyntra.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix \
  --set ingress.hosts[0].paths[0].service=dashboard
```

### Production install with values file

Create `my-values.yaml`:

```yaml
image:
  tag: "1.0.0"  # Pin to a specific version

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: kyntra.example.com
      paths:
        - path: /
          pathType: Prefix
          service: dashboard
    - host: api.kyntra.example.com
      paths:
        - path: /
          pathType: Prefix
          service: gateway
    - host: collector.kyntra.example.com
      paths:
        - path: /
          pathType: Prefix
          service: collector
  tls:
    - secretName: kyntra-tls
      hosts:
        - kyntra.example.com
        - api.kyntra.example.com
        - collector.kyntra.example.com

collector:
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 50

config:
  dashboardUrl: https://kyntra.example.com
  slackWebhookUrl: https://hooks.slack.com/xxx
  teamsWebhookUrl: https://xxx.webhook.office.com/xxx

postgresql:
  primary:
    persistence:
      size: 100Gi

redis:
  master:
    persistence:
      size: 20Gi
```

```bash
helm install kyntra ./infrastructure/helm \
  --namespace kyntra \
  --create-namespace \
  --set secrets.anthropicApiKey=sk-ant-xxx \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  -f my-values.yaml
```

### Using an external database

To use an existing PostgreSQL instance:

```yaml
postgresql:
  enabled: false

externalDatabase:
  url: postgresql://user:pass@host:5432/kyntra
```

### Upgrading

```bash
helm upgrade kyntra ./infrastructure/helm \
  --namespace kyntra \
  --reuse-values \
  --set image.tag=1.1.0
```

---

## Kubernetes

Raw manifests are in `infrastructure/k8s/`. Apply with:

```bash
bash infrastructure/scripts/deploy.sh
```

Or manually:

```bash
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/configmap.yaml
kubectl apply -f infrastructure/k8s/secret.yaml
kubectl apply -f infrastructure/k8s/postgres.yaml
kubectl apply -f infrastructure/k8s/redis.yaml
kubectl apply -f infrastructure/k8s/collector.yaml
kubectl apply -f infrastructure/k8s/analyzer.yaml
kubectl apply -f infrastructure/k8s/gateway.yaml
kubectl apply -f infrastructure/k8s/dashboard.yaml
kubectl apply -f infrastructure/k8s/ingress.yaml
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude AI |
| `JWT_SECRET` | Yes | ≥32-char random string for JWT signing |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook for alerts |
| `TEAMS_WEBHOOK_URL` | No | MS Teams incoming webhook for alerts |
| `PAGERDUTY_INTEGRATION_KEY` | No | PagerDuty Events API v2 integration key |
| `DASHBOARD_URL` | No | Public dashboard URL (used in alert links) |
| `GITHUB_APP_ID` | No | GitHub App ID (for PR reviews) |
| `GITHUB_APP_PRIVATE_KEY` | No | GitHub App private key (PEM format) |
| `GITHUB_WEBHOOK_SECRET` | No | GitHub webhook secret |
| `LOG_LEVEL` | No | `debug`/`info`/`warn`/`error` (default: `info`) |

---

## VCS Integrations

### GitHub

1. Create a GitHub App at https://github.com/settings/apps/new
2. Set the webhook URL to `https://api.your-domain.com/v1/github/webhook`
3. Subscribe to events: `Pull requests`
4. Generate a private key and download it
5. Set these env vars:
   ```
   GITHUB_APP_ID=12345
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
   GITHUB_WEBHOOK_SECRET=your-secret
   ```
6. In each project's Settings page, set the GitHub repo URL

### Azure DevOps

Configured per-project via the project's `settings` JSON (editable in the Settings page):

```json
{
  "azureDevopsRepoUrl": "https://dev.azure.com/myorg/MyProject/_git/my-repo",
  "azureDevopsToken": "your-personal-access-token",
  "azureDevopsWebhookSecret": "your-webhook-password"
}
```

To set up the service hook:
1. Go to your Azure DevOps project → Project Settings → Service Hooks
2. Create a new subscription → Web Hooks
3. Select trigger: **Pull request created** and **Pull request updated**
4. Set URL: `https://api.your-domain.com/v1/azure-devops/webhook`
5. Set Basic Auth password to the same value as `azureDevopsWebhookSecret`

The PAT needs these permissions: `Code (Read)`, `Pull Request Threads (Read & Write)`, `Code Status (Read & Write)`.

### Bitbucket Cloud

Configured per-project via the project's `settings` JSON:

```json
{
  "bitbucketRepoFullName": "workspace/repo-name",
  "bitbucketClientId": "your-oauth-app-key",
  "bitbucketClientSecret": "your-oauth-app-secret",
  "bitbucketWebhookSecret": "your-webhook-secret"
}
```

To set up:
1. Create an OAuth Consumer at https://bitbucket.org/workspace/settings/api → OAuth consumers
2. Set callback URL to `https://api.your-domain.com/` (placeholder — not used)
3. Grant permissions: `Repositories: Read`, `Pull requests: Read`, `Pull requests: Write`
4. Go to your repo → Repository Settings → Webhooks → Add webhook
5. URL: `https://api.your-domain.com/v1/bitbucket/webhook`
6. Triggers: `Pull Request: Created`, `Pull Request: Updated`

---

## Notifications

### Slack

1. Create an Incoming Webhook at https://api.slack.com/apps
2. Set `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx`

### Microsoft Teams

1. In your Teams channel → Manage channel → Connectors → Incoming Webhook
2. Create connector and copy the webhook URL
3. Set `TEAMS_WEBHOOK_URL=https://xxx.webhook.office.com/webhookb2/xxx`

### PagerDuty

1. Create an Events API v2 integration in your PagerDuty service
2. Set `PAGERDUTY_INTEGRATION_KEY=your-integration-key`

Alert channels are configured per-project in the Alerts UI. You can mix and match Slack + Teams + PagerDuty per alert rule.

---

## Database Migrations

Migrations are managed by Prisma and live in `services/collector/prisma/migrations/`.

### First-time setup
```bash
pnpm db:migrate   # Creates all tables
pnpm db:seed      # Creates demo project
```

### After upgrading Kyntra
```bash
pnpm db:migrate   # Applies new migrations
```

### In Kubernetes (Helm)
The Helm chart automatically runs `prisma migrate deploy` via an init container before the collector starts.

---

## Upgrading

### Docker Compose
```bash
git pull
docker compose build
docker compose up -d
docker compose exec collector pnpm prisma migrate deploy
```

### Helm
```bash
git pull
helm upgrade kyntra ./infrastructure/helm \
  --namespace kyntra \
  --reuse-values \
  --set image.tag=$(git describe --tags --abbrev=0)
```

---

## Monitoring Kyntra Itself

All services expose `/health` endpoints:

| Service | Health URL |
|---------|-----------|
| Collector | `GET /health` |
| Analyzer | `GET /health` |
| Gateway | `GET /health` |

For production, configure your uptime monitor to poll these. The gateway also exposes Prometheus-compatible metrics at `/metrics` (coming in a future release).

---

## License & Commercial Use

Kyntra is licensed under **AGPL-3.0**. This means:
- ✅ Free to self-host for any purpose
- ✅ Free to modify the source code
- ✅ Free to deploy internally within your organization
- ⚠️ If you offer Kyntra as a **hosted service to others**, you must open-source your modifications under AGPL-3.0
- ❌ Cannot embed in a proprietary closed-source product without a commercial license

For commercial licensing inquiries, contact **hello@kyntra.io**.
