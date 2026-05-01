export interface KyntraConfig {
  /** Your Kyntra project ID */
  projectId: string;
  /** Your Kyntra API key */
  apiKey: string;
  /** Kyntra collector endpoint (default: https://collector.kyntra.io) */
  endpoint?: string;
  /** Application environment */
  environment?: "production" | "staging" | "development" | "test";
  /** Service name (defaults to package.json name) */
  serviceName?: string;
  /** SDK version */
  sdkVersion?: string;
  /** Max batch size before flushing (default: 50) */
  batchSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushIntervalMs?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Fields to redact from payloads */
  maskedFields?: string[];
  /** Sample rate 0.0–1.0 (default: 1.0 = 100%) */
  sampleRate?: number;
  /** Disable SDK entirely (default: false) */
  disabled?: boolean;
}

export const DEFAULT_CONFIG: Required<
  Pick<KyntraConfig, "endpoint" | "environment" | "batchSize" | "flushIntervalMs" | "debug" | "sampleRate" | "disabled" | "maskedFields" | "sdkVersion">
> = {
  endpoint: "http://localhost:3001",
  environment: "development",
  batchSize: 50,
  flushIntervalMs: 5000,
  debug: false,
  sampleRate: 1.0,
  disabled: false,
  maskedFields: [],
  sdkVersion: "1.0.0",
};

let _config: (KyntraConfig & typeof DEFAULT_CONFIG) | null = null;

export function setConfig(config: KyntraConfig): void {
  _config = { ...DEFAULT_CONFIG, ...config };
}

export function getConfig(): KyntraConfig & typeof DEFAULT_CONFIG {
  if (!_config) {
    throw new Error(
      "[Kyntra] SDK not initialized. Call Kyntra.init() before using any SDK features."
    );
  }
  return _config;
}

export function isInitialized(): boolean {
  return _config !== null;
}
