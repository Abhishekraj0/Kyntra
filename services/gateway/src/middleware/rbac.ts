/**
 * Role-Based Access Control middleware for Kyntra.
 * 
 * Roles (hierarchy): owner > admin > member > viewer
 * All scopes: read, write, admin
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";

export type Role = "owner" | "admin" | "member" | "viewer";
export type Scope = "read" | "write" | "admin";

const ROLE_SCOPES: Record<Role, Set<Scope>> = {
  owner: new Set(["read", "write", "admin"]),
  admin: new Set(["read", "write", "admin"]),
  member: new Set(["read", "write"]),
  viewer: new Set(["read"]),
};

export function hasScope(role: Role, required: Scope): boolean {
  return ROLE_SCOPES[role]?.has(required) ?? false;
}

/**
 * Resolve identity from request.
 * Supports: Bearer JWT, X-Kyntra-Key (project API key), X-API-Key (team API key).
 */
export async function resolveIdentity(
  request: FastifyRequest,
  prisma: PrismaClient
): Promise<{ projectId?: string; teamId?: string; role: Role; userId?: string } | null> {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers["x-api-key"] as string | undefined;
  const projectKeyHeader = request.headers["x-kyntra-key"] as string | undefined;

  // Project API key (SDK usage)
  if (projectKeyHeader) {
    const project = await prisma.project.findUnique({
      where: { apiKey: projectKeyHeader },
      select: { id: true, teamId: true },
    });
    if (project) {
      return { projectId: project.id, teamId: project.teamId ?? undefined, role: "member" };
    }
  }

  // Team API key
  if (apiKeyHeader) {
    const prefix = apiKeyHeader.slice(0, 12);
    const hash = createHmac("sha256", process.env["JWT_SECRET"] ?? "dev")
      .update(apiKeyHeader)
      .digest("hex");

    const apiKey = await prisma.apiKey.findFirst({
      where: { keyPrefix: prefix, keyHash: hash },
      select: { teamId: true, scopes: true },
    });

    if (apiKey) {
      const role: Role = apiKey.scopes.includes("admin") ? "admin" : apiKey.scopes.includes("write") ? "member" : "viewer";
      return { teamId: apiKey.teamId, role };
    }
  }

  // Bearer token (simple JWT decode — in production use proper JWT library)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const [, payloadB64] = token.split(".");
      if (!payloadB64) return null;
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
        sub?: string; teamId?: string; role?: Role; exp?: number;
      };

      if (payload.exp && payload.exp < Date.now() / 1000) return null;

      return {
        ...(payload.sub ? { userId: payload.sub } : {}),
        ...(payload.teamId ? { teamId: payload.teamId } : {}),
        role: payload.role ?? "viewer",
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Create a scoped auth middleware factory.
 */
export function requireScope(scope: Scope) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const prisma = (request.server as { prisma?: PrismaClient }).prisma;
    if (!prisma) {
      return reply.status(500).send({ error: "Internal configuration error" });
    }

    const identity = await resolveIdentity(request, prisma);
    if (!identity) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!hasScope(identity.role, scope)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    // Attach identity to request for downstream use
    (request as FastifyRequest & { identity: typeof identity }).identity = identity;
  };
}
