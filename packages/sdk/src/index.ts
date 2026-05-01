/**
 * @kyntra/sdk — Node.js instrumentation SDK
 *
 * @example
 * import { Kyntra } from '@kyntra/sdk';
 *
 * Kyntra.init({
 *   projectId: 'proj_xxx',
 *   apiKey: 'kyn_live_xxx',
 *   environment: 'production',
 *   serviceName: 'my-api',
 * });
 */
import { setConfig, getConfig, isInitialized } from "./config.js";
import { queue } from "./queue.js";
import { patchHttp } from "./http-interceptor.js";
import type { KyntraConfig } from "./config.js";

export type { KyntraConfig } from "./config.js";
export { kyntraMiddleware } from "./express-middleware.js";

class KyntraClient {
  /**
   * Initialize the Kyntra SDK. Call this once at application startup,
   * before any other code runs.
   */
  init(config: KyntraConfig): void {
    setConfig(config);

    if (config.disabled) {
      return;
    }

    // Start background queue flusher
    queue.start();

    // Patch Node.js HTTP/HTTPS modules
    patchHttp();

    if (config.debug) {
      console.log(`[Kyntra] Initialized — project: ${config.projectId}, env: ${config.environment ?? "development"}`);
    }
  }

  /**
   * Manually record a custom event.
   */
  track(eventName: string, properties?: Record<string, unknown>): void {
    if (!isInitialized()) return;
    const config = getConfig();

    queue.enqueueEvent({
      projectId: config.projectId,
      sessionId: "server",
      type: "custom",
      url: "",
      metadata: { eventName, ...properties },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Flush the queue immediately. Useful before process shutdown.
   */
  async flush(): Promise<void> {
    if (!isInitialized()) return;
    await queue.flush();
  }

  /**
   * Shut down the SDK gracefully.
   */
  async shutdown(): Promise<void> {
    if (!isInitialized()) return;
    await queue.flush();
    queue.stop();
  }

  get isReady(): boolean {
    return isInitialized();
  }
}

export const Kyntra = new KyntraClient();
export default Kyntra;
