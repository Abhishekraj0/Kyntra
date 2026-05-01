import type { ApiTraceInput, UiEventInput, TraceBatch, EventBatch } from "@kyntra/shared";
import { getConfig } from "./config.js";

type QueueItem =
  | { type: "trace"; payload: ApiTraceInput }
  | { type: "event"; payload: UiEventInput };

class KyntraQueue {
  private queue: QueueItem[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  start(): void {
    const config = getConfig();
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, config.flushIntervalMs);

    // Flush on process exit
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => void this.flush());
      process.on("SIGTERM", () => void this.flush());
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  enqueueTrace(trace: ApiTraceInput): void {
    const config = getConfig();
    if (config.disabled) return;
    if (Math.random() > config.sampleRate) return;

    this.queue.push({ type: "trace", payload: trace });
    if (this.queue.length >= config.batchSize) {
      void this.flush();
    }
  }

  enqueueEvent(event: UiEventInput): void {
    const config = getConfig();
    if (config.disabled) return;

    this.queue.push({ type: "event", payload: event });
    if (this.queue.length >= config.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const items = this.queue.splice(0, this.queue.length);
    const config = getConfig();

    const traces = items
      .filter((i): i is Extract<QueueItem, { type: "trace" }> => i.type === "trace")
      .map((i) => i.payload);

    const events = items
      .filter((i): i is Extract<QueueItem, { type: "event" }> => i.type === "event")
      .map((i) => i.payload);

    const sentAt = new Date().toISOString();

    try {
      const requests: Promise<void>[] = [];

      if (traces.length > 0) {
        const batch: TraceBatch = {
          projectId: config.projectId,
          apiKey: config.apiKey,
          traces,
          sentAt,
          sdkVersion: config.sdkVersion,
        };
        requests.push(this.send(`${config.endpoint}/traces`, batch));
      }

      if (events.length > 0) {
        const batch: EventBatch = {
          projectId: config.projectId,
          apiKey: config.apiKey,
          events,
          sentAt,
          sdkVersion: config.sdkVersion,
        };
        requests.push(this.send(`${config.endpoint}/events`, batch));
      }

      await Promise.all(requests);
    } catch (err) {
      if (config.debug) {
        console.error("[Kyntra] Failed to flush queue:", err);
      }
      // Re-queue on failure (limited retry)
      if (items.length < 200) {
        this.queue.unshift(...items);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async send(url: string, body: unknown): Promise<void> {
    const config = getConfig();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kyntra-Key": config.apiKey,
        "X-Kyntra-SDK": config.sdkVersion,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && config.debug) {
      console.error(`[Kyntra] HTTP ${response.status} from ${url}`);
    }
  }
}

export const queue = new KyntraQueue();
