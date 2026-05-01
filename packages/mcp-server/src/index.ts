#!/usr/bin/env node
/**
 * Kyntra MCP Server
 * 
 * Exposes Kyntra engineering intelligence as MCP tools that can be used
 * by Claude, Claude Code, and any other MCP-compatible AI assistant.
 * 
 * Usage:
 *   npx @kyntra/mcp-server
 * 
 * Claude Code config (~/.claude/settings.json):
 *   {
 *     "mcpServers": {
 *       "kyntra": {
 *         "command": "npx",
 *         "args": ["@kyntra/mcp-server"],
 *         "env": {
 *           "KYNTRA_GATEWAY_URL": "http://localhost:3000",
 *           "KYNTRA_API_KEY": "kyn_team_xxx",
 *           "KYNTRA_PROJECT_ID": "proj_xxx"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { apiTools, type ApiToolName } from "./tools/api-tools.js";

const PROJECT_ID = process.env["KYNTRA_PROJECT_ID"] ?? "";

const TOOLS: Tool[] = [
  {
    name: "kyntra_list_endpoints",
    description: "List all monitored API endpoints for a Kyntra project with health scores, error rates, and latency.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID (uses KYNTRA_PROJECT_ID env if not provided)" },
        limit: { type: "number", description: "Max endpoints to return (default: 20)" },
      },
      required: [],
    },
  },
  {
    name: "kyntra_get_sla",
    description: "Get the current SLA status for a project: uptime percentage, error rate, health scores.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
      },
      required: [],
    },
  },
  {
    name: "kyntra_get_traces",
    description: "Get recent API traces/requests for debugging. Filter by endpoint path.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
        path: { type: "string", description: "Filter by endpoint path e.g. /api/users/:id" },
        limit: { type: "number", description: "Number of traces to return (default: 10)" },
      },
      required: [],
    },
  },
  {
    name: "kyntra_run_health_analysis",
    description: "Trigger an AI health analysis for a specific API endpoint using Claude. Returns analysis ID to poll.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
        endpointId: { type: "string", description: "API endpoint ID (get from kyntra_list_endpoints)" },
      },
      required: ["endpointId"],
    },
  },
  {
    name: "kyntra_list_reviews",
    description: "List recent AI code reviews with risk scores and PR details.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
        limit: { type: "number", description: "Number of reviews to return (default: 5)" },
      },
      required: [],
    },
  },
  {
    name: "kyntra_get_alerts",
    description: "Get active (unresolved) alert events for the project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
        limit: { type: "number", description: "Number of alerts to return (default: 10)" },
      },
      required: [],
    },
  },
  {
    name: "kyntra_export_openapi",
    description: "Generate and export an OpenAPI 3.0 specification from observed API traffic.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
      },
      required: [],
    },
  },
  {
    name: "kyntra_generate_tests",
    description: "Generate a complete test suite for an API endpoint using AI. Returns analysis ID.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Kyntra project ID" },
        endpointId: { type: "string", description: "API endpoint ID" },
        framework: { type: "string", enum: ["vitest", "jest"], description: "Test framework (default: vitest)" },
      },
      required: ["endpointId"],
    },
  },
];

const server = new Server(
  {
    name: "kyntra",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args ?? {}) as Record<string, unknown>;

  // Default projectId from env
  if (!toolArgs["projectId"] && PROJECT_ID) {
    toolArgs["projectId"] = PROJECT_ID;
  }

  if (!toolArgs["projectId"]) {
    return {
      content: [{ type: "text", text: "Error: projectId is required. Set KYNTRA_PROJECT_ID env var or pass projectId argument." }],
      isError: true,
    };
  }

  const toolMap: Record<string, ApiToolName> = {
    kyntra_list_endpoints: "list_api_endpoints",
    kyntra_get_sla: "get_sla_status",
    kyntra_get_traces: "get_recent_traces",
    kyntra_run_health_analysis: "run_health_analysis",
    kyntra_list_reviews: "list_code_reviews",
    kyntra_get_alerts: "get_alert_events",
    kyntra_export_openapi: "export_openapi",
    kyntra_generate_tests: "generate_tests",
  };

  const apiToolName = toolMap[name];
  if (!apiToolName) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const fn = apiTools[apiToolName] as (args: Record<string, unknown>) => Promise<unknown>;
    const result = await fn(toolArgs);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs on stdio — don't log to stdout
  process.stderr.write("Kyntra MCP server started\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
