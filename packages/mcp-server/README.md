# @kyntra/mcp-server

Query your Kyntra engineering intelligence from any MCP-compatible AI assistant (Claude, Claude Code, etc.)

## Install

```bash
npm install -g @kyntra/mcp-server
```

## Configure in Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "kyntra": {
      "command": "npx",
      "args": ["@kyntra/mcp-server"],
      "env": {
        "KYNTRA_GATEWAY_URL": "http://localhost:3000",
        "KYNTRA_API_KEY": "kyn_team_xxxx",
        "KYNTRA_PROJECT_ID": "your_project_id"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `kyntra_list_endpoints` | List all API endpoints with health scores |
| `kyntra_get_sla` | Get current SLA status and uptime |
| `kyntra_get_traces` | Get recent API traces for debugging |
| `kyntra_run_health_analysis` | Trigger AI health analysis |
| `kyntra_list_reviews` | List recent AI code reviews |
| `kyntra_get_alerts` | Get active alert events |
| `kyntra_export_openapi` | Generate OpenAPI spec |
| `kyntra_generate_tests` | Generate tests for an endpoint |

## Example Prompts

In Claude Code with the MCP server configured:

- "What's the current SLA status for my project?"
- "Show me the endpoints with the worst health scores"
- "Are there any active alerts?"
- "Run a health analysis on my payments endpoint"
- "Generate an OpenAPI spec for my project"
