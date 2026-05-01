# Kyntra Load Testing

Uses [k6](https://k6.io) to validate the collector can handle 50,000+ events/min.

## Quick start

```bash
# Install k6 (macOS)
brew install k6

# Run against local dev environment
k6 run infrastructure/load-testing/k6-scenario.js

# Run against staging with custom settings
k6 run \
  --env COLLECTOR_URL=https://collector.your-domain.com \
  --env API_KEY=kyn_live_xxx \
  --env PROJECT_ID=proj_xxx \
  infrastructure/load-testing/k6-scenario.js
```

## Thresholds

The test passes when:
- P95 request duration < 500ms
- P99 request duration < 1000ms
- Error rate < 1%
- Trace error rate < 1%
- Event error rate < 1%

## Expected throughput

At steady state (10 VUs, 100ms interval):
- ~100 requests/second
- ~800 traces/second (~48K/min)
- ~500 UI events/second (~30K/min)
- **Total: ~78K telemetry items/minute**
