#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="kyntra"
REGISTRY="${REGISTRY:-ghcr.io/kyntra}"
TAG="${TAG:-latest}"

echo "Deploying Kyntra v${TAG} to namespace ${NAMESPACE}..."

# Apply infrastructure first
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/configmap.yaml
kubectl apply -f infrastructure/k8s/postgres.yaml
kubectl apply -f infrastructure/k8s/redis.yaml

echo "Waiting for PostgreSQL to be ready..."
kubectl rollout status statefulset/kyntra-postgres -n ${NAMESPACE} --timeout=120s

# Run DB migrations
kubectl run --rm -it db-migrate \
  --namespace=${NAMESPACE} \
  --image=${REGISTRY}/collector:${TAG} \
  --restart=Never \
  --env="DATABASE_URL=$(kubectl get secret kyntra-secrets -n ${NAMESPACE} -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  -- npx prisma migrate deploy

# Deploy services
kubectl apply -f infrastructure/k8s/collector.yaml
kubectl apply -f infrastructure/k8s/analyzer.yaml
kubectl apply -f infrastructure/k8s/gateway.yaml
kubectl apply -f infrastructure/k8s/dashboard.yaml
kubectl apply -f infrastructure/k8s/ingress.yaml

# Wait for rollouts
echo "Waiting for rollouts..."
kubectl rollout status deployment/kyntra-collector -n ${NAMESPACE} --timeout=120s
kubectl rollout status deployment/kyntra-gateway -n ${NAMESPACE} --timeout=120s

echo "Deployment complete."
kubectl get pods -n ${NAMESPACE}
