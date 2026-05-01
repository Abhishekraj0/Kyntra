/**
 * Node.js HTTP/HTTPS interceptor.
 * Patches the built-in http and https modules to capture all outgoing requests.
 */
import * as http from "http";
import * as https from "https";
import {
  generateTraceId,
  generateSpanId,
  normalizePath,
  sanitizeHeaders,
  sanitizePayload,
  now,
} from "@kyntra/shared";
import { queue } from "./queue.js";
import { getConfig } from "./config.js";

type RequestModule = typeof http | typeof https;

let patched = false;

export function patchHttp(): void {
  if (patched) return;
  patched = true;

  patchModule(http);
  patchModule(https);
}

function patchModule(mod: RequestModule): void {
  const original = mod.request.bind(mod);


  mod.request = function (
    urlOrOptions: string | URL | http.RequestOptions,
    optionsOrCallback?: http.RequestOptions | ((res: http.IncomingMessage) => void),
    callback?: (res: http.IncomingMessage) => void
  ): http.ClientRequest {
    const startTime = Date.now();
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    // Determine URL and options
    let url: string;
    let options: http.RequestOptions;

    if (typeof urlOrOptions === "string" || urlOrOptions instanceof URL) {
      url = urlOrOptions.toString();
      options = typeof optionsOrCallback === "object" && !("statusCode" in optionsOrCallback)
        ? (optionsOrCallback as http.RequestOptions)
        : {};
    } else {
      options = urlOrOptions;
      url = buildUrl(options);
    }

    // Skip telemetry for calls to the Kyntra collector itself
    const config = getConfig();
    if (url.startsWith(config.endpoint)) {
      // @ts-expect-error — forwarding original call
      return original(urlOrOptions, optionsOrCallback, callback);
    }

    const method = (options.method ?? "GET").toUpperCase();
    const requestBodyChunks: Buffer[] = [];
    const responseBodyChunks: Buffer[] = [];

    // @ts-expect-error — forwarding original call
    const req: http.ClientRequest = original(urlOrOptions, optionsOrCallback, (res: http.IncomingMessage) => {
      res.on("data", (chunk: Buffer) => {
        responseBodyChunks.push(chunk);
      });

      res.on("end", () => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode ?? 0;
        const responseBody = parseBody(Buffer.concat(responseBodyChunks));

        let requestBody: unknown = undefined;
        if (requestBodyChunks.length > 0) {
          requestBody = parseBody(Buffer.concat(requestBodyChunks));
        }

        queue.enqueueTrace({
          projectId: config.projectId,
          traceId,
          spanId,
          method: method as import("@kyntra/shared").HttpMethod,
          url,
          statusCode,
          requestHeaders: sanitizeHeaders(headersToRecord(req.getHeaders())),
          requestBody: sanitizePayload(requestBody),
          responseHeaders: sanitizeHeaders(headersToRecord(res.headers as Record<string, string>)),
          responseBody: sanitizePayload(responseBody),
          durationMs,
          environment: config.environment,
          serviceId: config.serviceName ?? "unknown",
          tags: [],
          timestamp: now(),
        });
      });

      // Call the original callback if provided
      const cb = typeof optionsOrCallback === "function" ? optionsOrCallback : callback;
      if (cb) cb(res);
    });

    // Capture request body
    const originalWrite = req.write.bind(req);
    req.write = function (chunk: unknown, ...args: unknown[]) {
      if (Buffer.isBuffer(chunk)) {
        requestBodyChunks.push(chunk);
      } else if (typeof chunk === "string") {
        requestBodyChunks.push(Buffer.from(chunk));
      }
      // @ts-expect-error — dynamic args
      return originalWrite(chunk, ...args);
    };

    return req;
  };
}

function buildUrl(options: http.RequestOptions): string {
  const protocol = options.protocol ?? "http:";
  const host = options.hostname ?? options.host ?? "localhost";
  const port = options.port ? `:${options.port}` : "";
  const path = options.path ?? "/";
  return `${protocol}//${host}${port}${path}`;
}

function headersToRecord(
  headers: ReturnType<http.ClientRequest["getHeaders"]> | Record<string, string | string[] | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (val !== undefined) {
      result[key] = Array.isArray(val) ? val.join(", ") : String(val);
    }
  }
  return result;
}

function parseBody(buffer: Buffer): unknown {
  if (buffer.length === 0) return undefined;
  const text = buffer.toString("utf-8");
  try {
    return JSON.parse(text);
  } catch {
    return text.length > 1024 ? text.slice(0, 1024) + "...[truncated]" : text;
  }
}
