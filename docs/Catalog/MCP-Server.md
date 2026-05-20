# Platform MCP Server

The **Quilt Platform MCP Server** lets AI assistants interact with your
organization's data through natural language. Built on the open
[Model Context Protocol](https://modelcontextprotocol.io/), it connects
Claude, Cursor, and other MCP-compatible clients directly to your Quilt
environment — so users can search, browse, read, create, and query data
without leaving their AI workflow.

All actions respect your existing Quilt roles and permissions. Data never
leaves your AWS environment.

## Capabilities

### Search

Ask your AI assistant to find packages or S3 objects by name, content,
metadata, or any combination. Searches use Elasticsearch query syntax
under the hood, so you can be as broad ("RNA-seq experiments") or
specific (`ext:.parquet AND key:results/*`) as you like. Results are
paginated automatically — just ask for more if the first page isn't
enough.

### Packages

Your AI assistant can list packages in a bucket, browse a package's file
tree, inspect revision metadata and history, create new packages from S3
objects or inline content, and patch existing packages by adding,
updating, or removing entries — all without leaving the conversation.
Workflows and user metadata are supported on create and update.

### S3 Objects

List, read, inspect, download, and upload S3 objects. The assistant can
read text, images, and binary files directly from `s3://` or
`quilt+s3://` URIs, retrieve object metadata (size, content type, last
modified), generate presigned download URLs you can open in a browser,
and upload new content to S3.

### Athena

Run SQL queries against your data lake through Amazon Athena and get
results back in the conversation. This works with both standard Athena
tables and Quilt Tabulator tables — the assistant automatically has
access to available databases and catalogs.

### Tabulator

List, create, rename, and manage Tabulator table definitions that
control how package data is projected into queryable Athena tables.

### Utilities

The assistant can list your accessible buckets, generate shareable Quilt
catalog links for any resource, and read platform configuration such as
search syntax help and Athena setup details.

---

## Resources

The Platform MCP Server also exposes read-only resources that give AI
assistants additional context about your environment:

<!-- markdownlint-disable line-length -->
| Resource | Description |
| --- | --- |
| **Search Syntax** | Elasticsearch query string syntax reference for search |
| **Athena** | Available databases, catalogs, and query configuration |
| **Buckets** | Accessible buckets with names, titles, and descriptions |
| **Current User** | Identity and role of the authenticated user |
<!-- markdownlint-enable line-length -->

---

## Getting Started

### Supported Clients

The Platform MCP Server works with any MCP-compatible AI client, including:

- **Claude.ai** (web)
- **Cursor** (desktop)
- **Any client** supporting the [Model Context Protocol](https://modelcontextprotocol.io/)

### Connecting Claude.ai

An Organization administrator adds Quilt as a connector:

1. Go to [Organization Settings -> Connectors](https://claude.ai/admin-settings/connectors)
2. Click **Add Custom Connector**
3. Enter your Connect Server URL: `https://<connect-host>/mcp/platform/mcp`

### Connecting Cursor and other desktop clients

Add the following to your MCP client configuration
(in Cursor: **Settings -> MCP -> Add new global MCP server**):

```json
{
  "mcpServers": {
    "quilt": {
      "url": "https://<connect-host>/mcp/platform/mcp"
    }
  }
}
```

> Your administrator must include the client's custom scheme (e.g. `cursor://`)
> in `ConnectAllowedHosts` for the OAuth flow to complete.

### User Authorization

Each user must authorize their MCP connection once:

**Web clients (e.g. Claude.ai):**

1. Log in to your Quilt stack as usual (e.g. via Okta SSO)
2. Go to [Settings -> Connectors](https://claude.ai/settings/connectors)
3. Click **Connect**

**Desktop clients (e.g. Cursor):** the OAuth flow starts automatically the
first time the client connects to the MCP server.

In both cases, you will see the Quilt authorization page at
`/connect/authorize`, showing the name of the AI client and what it is
requesting access to. Click **Continue** to grant access or **Cancel** to
deny it.

After authorizing, the AI assistant receives a session token scoped to your
Quilt user — it cannot access data beyond what your assigned Quilt role
permits. You do not need to re-authorize the same client unless your session
expires or the Quilt stack is redeployed.

Once authenticated, you may also need to authorize individual tools when
used. You can pre-authorize them by clicking **Configure** on the connector
page.

![Quilt Connect Server](../imgs/connect-authorize.png)

![Quilt MCP Configuration](../imgs/mcp-tools.png)

### Headless Access with API Keys

For automation, AWS-side services, and other non-interactive clients
that cannot complete an OAuth flow, the MCP server also accepts a
[Quilt API key](../api-reference/authentication.md#api-keys) as a bearer
token:

```http
POST https://<connect-host>/mcp/platform/mcp
Authorization: Bearer qk_...
```

For stdio-mode MCP clients, set the key in the environment instead:

```bash
export QUILT_API_KEY=qk_...
```

The MCP request executes under the API key owner's role and bucket
permissions, exactly as an OAuth-issued session would. Generate, list,
and revoke keys via `quilt3.api_keys` (see the [Authentication
guide](../api-reference/authentication.md)).

---

## Administrator Reference

The Platform MCP Server runs behind
[Quilt Connect Server](Connect.md), which handles OAuth authentication,
session tokens, and request routing within your AWS environment. See the
[Quilt Connect](Connect.md) page for CloudFormation parameters, DNS
configuration, and IP allowlisting.
