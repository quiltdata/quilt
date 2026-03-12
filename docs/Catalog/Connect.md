<!-- markdownlint-disable-next-line first-line-h1 -->
> Connect Server requires Quilt Platform version 1.68 or later.

**Quilt Connect Server** is an identity provider and gateway that enables
external services to securely interact with your Quilt data and perform
actions on behalf of your users. Connect Server:

- Authenticates requests using your organization's identity provider
- Issues session tokens scoped to individual user permissions
- Routes requests to authorized services within your AWS environment

One such service is the **Quilt Platform MCP Server** (below), which lets
AI assistants — such as Claude.ai, Cursor, and other
[MCP](https://modelcontextprotocol.io/) clients — interact with
your Quilt data through natural language.

## Admin Setup

Connect Server is disabled by default. To enable it, set the `ConnectAllowedHosts`
CloudFormation parameter to a non-empty value.

### CloudFormation Parameters

<!-- markdownlint-disable line-length table-column-style -->
| Parameter               | Default       | Description |
| ----------------------- | ------------- | --------------------------------------------------- |
| `ConnectAllowedHosts`   | _(empty)_     | Comma-separated list of allowed OAuth redirect origins. Empty = disabled. See [Entry formats](#connectallowedhosts-entry-formats) below. |
| `ConnectSecurityGroup`  | _(empty)_     | Optional EC2 security group ID for Connect ALB      |
|                         |               | IP allowlisting. Empty = allow all.                 |
| `CertificateArnConnect` | _(empty)_     | Optional ACM certificate ARN for the Connect ALB.   |
|                         |               | Empty = reuses main stack TLS certificate.          |
<!-- markdownlint-enable line-length table-column-style -->

#### `ConnectAllowedHosts` Entry Formats

Each comma-separated entry can be one of:

| Format | Example | Matches |
| --- | --- | --- |
| **Hostname** | `claude.ai` | `https://claude.ai/*` (HTTPS only) |
| **Custom scheme** | `cursor://` | `cursor://<any-host>/*` (for desktop apps that register a custom URI scheme) |
| **Localhost** | `localhost` | `http://localhost:<any-port>/*` and `http://127.0.0.1:<any-port>/*` (HTTP only; configuring either loopback address enables both) |

Example covering web, desktop, and local clients:

```
claude.ai, claude.com, cursor://, localhost
```

Entries are case-insensitive. Trailing dots on hostnames are ignored.
Network schemes (`http://`, `https://`, etc.) are not valid entries and are
silently ignored — use a bare hostname for HTTPS clients and a custom scheme
(`cursor://`) for desktop clients.

### DNS Configuration

After deploying with Connect enabled, create a DNS alias record for your
Connect subdomain (typically `<stack-name>-connect.<your-domain>`):

| Route 53 Field  | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Record type     | `A` (alias)                                             |
| Alias target    | `ConnectLoadBalancerDNSName` CloudFormation output      |
| Hosted zone ID  | `ConnectLoadBalancerCanonicalHostedZoneID` output       |

The final Connect Server hostname is available in the `ConnectHost` CloudFormation
output.

### IP Allowlisting (Optional)

To restrict which IP ranges can reach the Connect Server, create an EC2
security group with inbound rules on port 443 for your trusted CIDR ranges,
then pass the security group ID as `ConnectSecurityGroup`. If omitted, the
Connect ALB accepts traffic from any IP.

## Platform MCP Server

The Platform MCP Server is a service that runs behind Connect Server. It allows
AI assistants to search packages, browse buckets, and retrieve data on your
behalf, all within your organization's AWS environment and subject to your
existing Quilt permissions.

### MCP Client Setup

Your Quilt administrator will provide a **Connect Server URL** of the form
`https://<stack-name>-connect.<your-domain>`.

#### Claude.ai (web)

An Organization administrator adds Quilt as a connector:

1. Go to [Organization Settings -> Connectors](https://claude.ai/admin-settings/connectors)
2. Click **Add Custom Connector**
3. Enter your Connect Server URL: `https://<connect-host>/mcp/platform/mcp`

#### Cursor and other desktop MCP clients

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

### MCP User Authorization

Next, each user must authorize their MCP connection.

For web clients (e.g. Claude.ai):

1. Login to your Quilt stack as usual (e.g., via Okta SSO)
2. Go to [Settings -> Connectors](https://claude.ai/settings/connectors)
3. Click **Connect**

For desktop clients (e.g. Cursor), the OAuth flow starts automatically the
first time the client connects to the MCP server.

In both cases, you will see the Quilt catalog authorization page at
`/connect/authorize`. This page shows:

- The name of the AI client requesting access
- What the client is allowed to do (read access, scoped to your Quilt role)

![Quilt Connect Server](../imgs/connect-authorize.png)

Click **Continue** to grant access, or **Cancel** to deny it. After
authorizing, the AI assistant receives a session token scoped to your Quilt
user — it cannot access data beyond what your assigned Quilt role permits.

You do not need to re-authorize the same client unless your session expires
or the Quilt stack is redeployed.

Once authenticated, you may also need to authorize individual tools when used.
You can pre-authorize them by clicking **Configure** on the connector page.

![Quilt MCP Configuration](../imgs/mcp-tools.png)
