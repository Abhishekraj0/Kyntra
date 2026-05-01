/**
 * Kyntra load test — verifies the collector can handle 50,000 events/min
 *
 * Usage:
 *   k6 run infrastructure/load-testing/k6-scenario.js
 *   k6 run --env COLLECTOR_URL=http://your-host:3001 infrastructure/load-testing/k6-scenario.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const COLLECTOR_URL = __ENV.COLLECTOR_URL || "http://localhost:3001";
const API_KEY = __ENV.API_KEY || "kyn_demo_test_key";
const PROJECT_ID = __ENV.PROJECT_ID || "demo_project_id";

// Custom metrics
const tracesSent = new Counter("kyntra_traces_sent");
const eventsSent = new Counter("kyntra_events_sent");
const traceErrors = new Rate("kyntra_trace_errors");
const eventErrors = new Rate("kyntra_event_errors");
const traceDuration = new Trend("kyntra_trace_duration_ms");
const eventDuration = new Trend("kyntra_event_duration_ms");

// Load profile: ramp to 50K events/min (~833 events/sec)
// At 10 VUs each sending 1 request/100ms = 100 req/s * avg 8 traces/batch = 800 traces/s ~= 48K/min
export const options = {
  stages: [
    { duration: "30s", target: 5 },    // Warm up
    { duration: "1m", target: 10 },    // Ramp to steady state
    { duration: "3m", target: 10 },    // Hold at 50K events/min
    { duration: "30s", target: 20 },   // Spike test
    { duration: "30s", target: 10 },   // Return to normal
    { duration: "30s", target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.01"],
    kyntra_trace_errors: ["rate<0.01"],
    kyntra_event_errors: ["rate<0.01"],
  },
};

const PATHS = [
  "/api/users",
  "/api/users/:id",
  "/api/products",
  "/api/products/:id",
  "/api/orders",
  "/api/orders/:id",
  "/api/payments",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/search",
];

const METHODS = ["GET", "GET", "GET", "POST", "PUT", "DELETE"];
const STATUS_CODES = [200, 200, 200, 200, 201, 400, 404, 500];
const SERVICES = ["api-gateway", "user-service", "product-service", "order-service"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

function generateTrace() {
  const method = randomFrom(METHODS);
  const path = randomFrom(PATHS);
  const statusCode = randomFrom(STATUS_CODES);
  const durationMs = Math.floor(Math.random() * 500) + 10;

  return {
    projectId: PROJECT_ID,
    traceId: `tr_${randomId()}`,
    spanId: `sp_${randomId()}`,
    method,
    url: `https://api.example.com${path.replace(":id", randomId())}`,
    statusCode,
    requestHeaders: { "content-type": "application/json", "user-agent": "k6-load-test/1.0" },
    responseHeaders: { "content-type": "application/json" },
    durationMs,
    environment: "staging",
    serviceId: randomFrom(SERVICES),
    tags: ["load-test"],
    timestamp: new Date().toISOString(),
  };
}

function generateUiEvent() {
  const types = ["click", "navigation", "api_call", "page_load", "error"];
  const type = randomFrom(types);
  return {
    projectId: PROJECT_ID,
    sessionId: `sess_${randomId()}`,
    type,
    url: `https://app.example.com/${randomFrom(["dashboard", "settings", "reports", "apis"])}`,
    metadata: { element: "button.primary", durationMs: Math.floor(Math.random() * 200) },
    timestamp: new Date().toISOString(),
  };
}

export function tracesScenario() {
  const batchSize = Math.floor(Math.random() * 5) + 5; // 5-10 traces per request
  const traces = Array.from({ length: batchSize }, generateTrace);

  const start = Date.now();
  const res = http.post(
    `${COLLECTOR_URL}/traces`,
    JSON.stringify({ traces }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Kyntra-Key": API_KEY,
      },
    }
  );
  traceDuration.add(Date.now() - start);

  const ok = check(res, {
    "traces: status 200": (r) => r.status === 200 || r.status === 201,
    "traces: response time < 500ms": (r) => r.timings.duration < 500,
  });

  traceErrors.add(!ok);
  if (ok) tracesSent.add(batchSize);
}

export function eventsScenario() {
  const batchSize = Math.floor(Math.random() * 5) + 3; // 3-8 events per request
  const events = Array.from({ length: batchSize }, generateUiEvent);

  const start = Date.now();
  const res = http.post(
    `${COLLECTOR_URL}/events`,
    JSON.stringify({ projectId: PROJECT_ID, apiKey: API_KEY, events, sentAt: new Date().toISOString(), sdkVersion: "1.0.0" }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Kyntra-Key": API_KEY,
      },
    }
  );
  eventDuration.add(Date.now() - start);

  const ok = check(res, {
    "events: status 200": (r) => r.status === 200 || r.status === 201,
    "events: response time < 500ms": (r) => r.timings.duration < 500,
  });

  eventErrors.add(!ok);
  if (ok) eventsSent.add(batchSize);
}

export function healthScenario() {
  const res = http.get(`${COLLECTOR_URL}/health`);
  check(res, {
    "health: status 200": (r) => r.status === 200,
  });
}

// Default scenario mixes traces, events, and health checks
export default function () {
  const rand = Math.random();
  if (rand < 0.5) {
    tracesScenario();
  } else if (rand < 0.9) {
    eventsScenario();
  } else {
    healthScenario();
  }
  sleep(0.1); // 100ms between requests per VU
}
