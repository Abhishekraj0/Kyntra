/**
 * Express/Fastify middleware for server-side request tracing.
 * Use this to trace inbound requests to your own API.
 */
import type { Request, Response, NextFunction } from "express";
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

export function kyntraMiddleware() {
  return function (req: Request, res: Response, next: NextFunction): void {
    const config = getConfig();
    if (config.disabled) {
      next();
      return;
    }

    const startTime = Date.now();
    const traceId = (req.headers["x-trace-id"] as string) ?? generateTraceId();
    const spanId = generateSpanId();

    // Inject trace headers into downstream requests
    req.headers["x-kyntra-trace-id"] = traceId;
    req.headers["x-kyntra-span-id"] = spanId;

    const originalJson = res.json.bind(res);
    let responseBody: unknown;

    res.json = function (body: unknown) {
      responseBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      const durationMs = Date.now() - startTime;
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      queue.enqueueTrace({
        projectId: config.projectId,
        traceId,
        spanId,
        method: req.method as import("@kyntra/shared").HttpMethod,
        url,
        statusCode: res.statusCode,
        requestHeaders: sanitizeHeaders(req.headers as Record<string, string>),
        requestBody: sanitizePayload(req.body),
        responseHeaders: sanitizeHeaders(res.getHeaders() as Record<string, string>),
        responseBody: sanitizePayload(responseBody),
        durationMs,
        environment: config.environment,
        serviceId: config.serviceName ?? req.hostname,
        tags: ["inbound"],
        timestamp: now(),
      });
    });

    next();
  };
}
