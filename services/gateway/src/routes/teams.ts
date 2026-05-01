import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateId, slugify } from "@kyntra/shared";
import { createHmac, randomBytes } from "crypto";

const CreateTeamSchema = z.object({
  name: z.string().min(2).max(100),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().default(""),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

const CreateApiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(["read", "write", "admin"])).default(["read"]),
  expiresInDays: z.number().int().positive().optional(),
});

export async function teamsRoutes(app: FastifyInstance, { prisma }: { prisma: PrismaClient }): Promise<void> {
  // Create team
  app.post("/v1/teams", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateTeamSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });

    const { name } = parsed.data;
    const baseSlug = slugify(name);

    const team = await prisma.team.create({
      data: {
        id: generateId(),
        name,
        slug: `${baseSlug}-${generateId().slice(0, 6)}`,
        plan: "free",
      },
    });

    return reply.status(201).send({ data: team });
  });

  // Get team
  app.get("/v1/teams/:teamId", async (
    req: FastifyRequest<{ Params: { teamId: string } }>,
    reply: FastifyReply
  ) => {
    const team = await prisma.team.findUnique({
      where: { id: req.params.teamId },
      include: {
        members: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
        _count: { select: { projects: true } },
      },
    });

    if (!team) return reply.status(404).send({ error: "Team not found" });
    return reply.send({ data: team });
  });

  // List team members
  app.get("/v1/teams/:teamId/members", async (
    req: FastifyRequest<{ Params: { teamId: string } }>,
    reply: FastifyReply
  ) => {
    const members = await prisma.teamMember.findMany({
      where: { teamId: req.params.teamId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ data: members });
  });

  // Invite member
  app.post("/v1/teams/:teamId/members", async (
    req: FastifyRequest<{ Params: { teamId: string } }>,
    reply: FastifyReply
  ) => {
    const parsed = InviteMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });

    const { email, name, role } = parsed.data;
    const userId = generateId("user");

    const member = await prisma.teamMember.upsert({
      where: { teamId_email: { teamId: req.params.teamId, email } },
      create: { id: generateId(), teamId: req.params.teamId, userId, email, name, role },
      update: { role, name },
    });

    return reply.status(201).send({ data: member });
  });

  // Remove member
  app.delete("/v1/teams/:teamId/members/:memberId", async (
    req: FastifyRequest<{ Params: { teamId: string; memberId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.teamMember.deleteMany({
      where: { id: req.params.memberId, teamId: req.params.teamId },
    });
    return reply.status(204).send();
  });

  // Create API key
  app.post("/v1/teams/:teamId/api-keys", async (
    req: FastifyRequest<{ Params: { teamId: string } }>,
    reply: FastifyReply
  ) => {
    const parsed = CreateApiKeySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten() });

    const { name, scopes, expiresInDays } = parsed.data;
    const rawKey = `kyn_team_${randomBytes(24).toString("base64url")}`;
    const prefix = rawKey.slice(0, 12);
    const hash = createHmac("sha256", process.env["JWT_SECRET"] ?? "dev")
      .update(rawKey)
      .digest("hex");

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey = await prisma.apiKey.create({
      data: {
        id: generateId(),
        teamId: req.params.teamId,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes,
        expiresAt,
        createdBy: "system",
      },
    });

    // Return the raw key ONCE — it can never be retrieved again
    return reply.status(201).send({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.keyPrefix,
        key: rawKey, // Only shown once!
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      warning: "Store this key securely. It will not be shown again.",
    });
  });

  // List API keys (without raw key values)
  app.get("/v1/teams/:teamId/api-keys", async (
    req: FastifyRequest<{ Params: { teamId: string } }>,
    reply: FastifyReply
  ) => {
    const keys = await prisma.apiKey.findMany({
      where: { teamId: req.params.teamId },
      select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: keys });
  });

  // Delete API key
  app.delete("/v1/teams/:teamId/api-keys/:keyId", async (
    req: FastifyRequest<{ Params: { teamId: string; keyId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.apiKey.deleteMany({
      where: { id: req.params.keyId, teamId: req.params.teamId },
    });
    return reply.status(204).send();
  });
}
