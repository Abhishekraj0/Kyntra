# Kyntra Helm Chart

## Installation

### Prerequisites
- Kubernetes 1.25+
- Helm 3.x
- cert-manager (optional, for TLS)

### Quick Install

```bash
# Add dependencies (Bitnami for PostgreSQL + Redis)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update ./infrastructure/helm

# Install with minimal config
helm install kyntra ./infrastructure/helm \
  --set secrets.anthropicApiKey=sk-ant-xxx \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=kyntra.example.com
```

### Production Install

```bash
helm install kyntra ./infrastructure/helm \
  --namespace kyntra \
  --create-namespace \
  -f my-values.yaml
```

### Configuration

See `values.yaml` for all available options.

Key values to configure:
- `secrets.anthropicApiKey` — Required for AI features
- `secrets.jwtSecret` — Random 32-byte string for JWT signing
- `ingress.enabled` + `ingress.hosts` — Set your domain names
- `config.slackWebhookUrl` — For Slack alert notifications
- `config.teamsWebhookUrl` — For MS Teams alert notifications
