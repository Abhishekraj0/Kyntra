/**
 * Browser SDK — captures UI events, Web Vitals, and fetch/XHR calls.
 * Include in your frontend app:
 *   import { KyntraBrowser } from '@kyntra/sdk/browser';
 *   KyntraBrowser.init({ projectId: 'xxx', apiKey: 'yyy' });
 */
import type { UiEventInput, UiEventType, WebVitals } from "@kyntra/shared";
import { generateId, now, sanitizePayload } from "@kyntra/shared";

interface BrowserConfig {
  projectId: string;
  apiKey: string;
  endpoint?: string;
  environment?: string;
  sessionId?: string;
  userId?: string;
  debug?: boolean;
  captureClicks?: boolean;
  captureNavigation?: boolean;
  captureErrors?: boolean;
  capturePerformance?: boolean;
  captureFetch?: boolean;
}

class KyntraBrowserClient {
  private config: Required<BrowserConfig> | null = null;
  private sessionId = generateId("sess");
  private eventQueue: UiEventInput[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  init(config: BrowserConfig): void {
    this.config = {
      endpoint: "http://localhost:3001",
      environment: "production",
      sessionId: this.sessionId,
      userId: "",
      debug: false,
      captureClicks: true,
      captureNavigation: true,
      captureErrors: true,
      capturePerformance: true,
      captureFetch: true,
      ...config,
    };

    this.setupListeners();
    this.startFlushTimer();

    if (this.config.debug) {
      console.log("[Kyntra Browser] Initialized");
    }
  }

  private setupListeners(): void {
    const c = this.config!;

    if (c.captureClicks) {
      document.addEventListener("click", (e) => this.handleClick(e), true);
    }

    if (c.captureNavigation) {
      this.captureNavigation();
    }

    if (c.captureErrors) {
      window.addEventListener("error", (e) => this.handleError(e));
      window.addEventListener("unhandledrejection", (e) => this.handleUnhandledRejection(e));
    }

    if (c.capturePerformance) {
      this.captureWebVitals();
    }

    if (c.captureFetch) {
      this.patchFetch();
    }
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target) return;

    const selector = getSelector(target);
    const text = (target as HTMLElement).innerText?.slice(0, 100);

    this.track("click", {
      element: selector,
      text,
      x: event.clientX,
      y: event.clientY,
      tagName: target.tagName,
    });
  }

  private captureNavigation(): void {
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      originalPushState(...args);
      this.track("navigation", { to: window.location.href, type: "pushState" });
    };

    history.replaceState = (...args) => {
      originalReplaceState(...args);
      this.track("navigation", { to: window.location.href, type: "replaceState" });
    };

    window.addEventListener("popstate", () => {
      this.track("navigation", { to: window.location.href, type: "popstate" });
    });

    // Initial page load
    this.track("page_load", {
      url: window.location.href,
      referrer: document.referrer,
    });
  }

  private handleError(event: ErrorEvent): void {
    this.track("error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack?.slice(0, 1000),
    });
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    this.track("error", {
      type: "unhandled_rejection",
      message: String(event.reason),
      stack: event.reason?.stack?.slice(0, 1000),
    });
  }

  private captureWebVitals(): void {
    // Use PerformanceObserver for LCP, FID, CLS
    if (!("PerformanceObserver" in window)) return;

    const vitals: WebVitals = {};

    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          vitals.lcp = last.startTime;
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch { /* LCP not supported */ }

    // CLS
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
            clsValue += (entry as PerformanceEntry & { value?: number }).value ?? 0;
          }
        }
        vitals.cls = clsValue;
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch { /* CLS not supported */ }

    // TTFB from Navigation Timing
    window.addEventListener("load", () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        vitals.ttfb = nav.responseStart - nav.fetchStart;
        vitals.fcp = nav.loadEventStart;
      }

      this.track("performance", { vitals });
    });
  }

  private patchFetch(): void {
    const originalFetch = window.fetch.bind(window);
    const self = this;
    const config = this.config!;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const startTime = Date.now();
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      // Skip Kyntra collector calls
      if (url.startsWith(config.endpoint)) {
        return originalFetch(input, init);
      }

      try {
        const response = await originalFetch(input, init);
        const durationMs = Date.now() - startTime;

        self.track("api_call", {
          method: init?.method ?? "GET",
          url,
          status: response.status,
          durationMs,
          ok: response.ok,
        }, durationMs);

        return response;
      } catch (err) {
        const durationMs = Date.now() - startTime;
        self.track("api_call", {
          method: init?.method ?? "GET",
          url,
          error: String(err),
          durationMs,
          ok: false,
        }, durationMs);
        throw err;
      }
    };
  }

  track(type: UiEventType, metadata: Record<string, unknown>, durationMs?: number): void {
    if (!this.config) return;

    const event: UiEventInput = {
      projectId: this.config.projectId,
      sessionId: this.config.sessionId,
      ...(this.config.userId ? { userId: this.config.userId } : {}),
      type,
      url: window.location.href,
      metadata: sanitizePayload(metadata) as Record<string, unknown>,
      timestamp: now(),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };

    this.eventQueue.push(event);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.config) return;
    this.config.userId = userId;
    this.track("custom", { type: "identify", userId, traits });
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => void this.flush(), 5000);

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.flush();
    });
  }

  private async flush(): Promise<void> {
    if (!this.config || this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.eventQueue.length);

    try {
      await fetch(`${this.config.endpoint}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kyntra-Key": this.config.apiKey,
        },
        body: JSON.stringify({
          projectId: this.config.projectId,
          apiKey: this.config.apiKey,
          events,
          sentAt: now(),
          sdkVersion: "1.0.0",
        }),
        keepalive: true,
      });
    } catch (err) {
      if (this.config.debug) {
        console.error("[Kyntra Browser] Failed to flush events:", err);
      }
      // Re-queue on failure
      this.eventQueue.unshift(...events);
    }
  }
}

function getSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && parts.length < 5) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    const classNames = Array.from(current.classList).slice(0, 2).join(".");
    if (classNames) selector += `.${classNames}`;
    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

export const KyntraBrowser = new KyntraBrowserClient();
