<!--pytest-codeblocks:skipfile-->
# Quilt MCP Server

The [Quilt MCP Server](https://github.com/quiltdata/quilt-mcp-server) is a
standalone, open-source MCP server that connects AI assistants — including
Claude, Claude Code, and any [MCP](https://modelcontextprotocol.io)-compatible
client — to your Quilt data catalog. It exposes 84+ tools for searching,
analyzing, and managing Quilt packages directly from natural-language
conversations.

Quilt Platform v1.68+ also includes a built-in
[Quilt Connect](../Catalog/Connect.md) MCP server that requires no local
installation, though it currently exposes fewer tools than quilt-mcp-server.

## Quick Start

### Claude Desktop (One-Click)

1. Download the latest `.mcpb` bundle from
   [GitHub releases](https://github.com/quiltdata/quilt-mcp-server/releases)
2. Double-click to install, or drag it to Claude Desktop
3. Configure your catalog in **Settings → Extensions → Quilt MCP**

### Claude Code CLI

```bash
npx @anthropic-ai/claude-code mcp add quilt-mcp uvx quilt-mcp \
  -e QUILT_CATALOG_URL=https://your-catalog.quiltdata.com \
  -e QUILT_REGISTRY_URL=https://registry.your-catalog.quiltdata.com \
  -e AWS_PROFILE=your-profile
```

### Terminal (uvx)

```bash
# Requires uv: https://docs.astral.sh/uv/
uvx quilt-mcp
```

### Custom MCP Clients

Add to your `mcp.json`:

```json
{
  "mcpServers": {
    "quilt": {
      "command": "uvx",
      "args": ["quilt-mcp"],
      "env": {
        "QUILT_CATALOG_URL": "https://quilt-stack.yourcompany.com",
        "QUILT_REGISTRY_URL": "https://registry.quilt-stack.yourcompany.com"
      }
    }
  }
}
```

## Configuration

### Authentication

Authenticate with your Quilt catalog before starting the server:

```bash
# Configure catalog URL (interactive)
quilt3 config

# Or set directly
quilt3 config https://your-stack.your-company.com

# Login (opens browser for SSO, or prompts for credentials)
quilt3 login
```

### Deployment Modes

| Mode | Backend | Transport | Use case |
| --- | --- | --- | --- |
| `local` (default) | Platform API | stdio | Claude Desktop / Claude Code |
| `remote` | Platform API | HTTP | Claude.ai / hosted MCP clients |
| `legacy` | quilt3 library | stdio | Local development without a catalog |

```bash
uvx quilt-mcp --deployment local   # default
uvx quilt-mcp --deployment remote
uvx quilt-mcp --deployment legacy
```

### Environment Variables

| Variable | Description |
| --- | --- |
| `QUILT_CATALOG_URL` | Your Quilt catalog URL |
| `QUILT_REGISTRY_URL` | Your Quilt registry URL |
| `QUILT_DEPLOYMENT` | Deployment mode (`local`, `remote`, `legacy`) |
| `AWS_PROFILE` | AWS credentials profile for S3 access |

## What You Can Do

Once connected, you can ask your AI assistant to:

- **Search** packages and data across buckets using natural language
- **Browse** package contents, metadata, and revision history
- **Create and update** packages from S3 objects
- **Manage** workflows and bucket configurations
- **Analyze** data in packages without leaving your conversation

## Installation

Requires Python 3.11+ and [`uv`](https://docs.astral.sh/uv/).

```bash
# Install globally
uv tool install quilt-mcp

# Or run without installing
uvx quilt-mcp
```

For Docker deployment and advanced configuration, see the
[quilt-mcp-server README](https://github.com/quiltdata/quilt-mcp-server).
