<!-- markdownlint-disable-next-line first-line-h1 -->
**Quilt Connect** lets you use AI assistants — like Claude in Claude.ai or Claude Code —
to interact with your Quilt data through natural language and the
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Once connected, AI
assistants can search packages, browse buckets, and retrieve data on your behalf, all
within your organization's AWS environment and subject to your existing Quilt permissions.

## Using AI Assistants with Quilt

Your Quilt administrator will provide a **Connect Server URL** of the form
`https://<stack-name>-connect.<your-domain>`. You need this URL to add Quilt as an MCP
server in your AI assistant.

### Claude.ai

1. Open [Claude.ai](https://claude.ai) and navigate to **Settings → Integrations**.
2. Click **Add Integration**.
3. Enter your Connect Server URL: `https://<connect-host>/mcp/platform`
4. Follow the OAuth authorization prompt (see [Authorization](#authorization) below).

Once added, you can ask Claude questions like:

- _"What packages are in my quilt bucket?"_
- _"Find the latest version of the genomics dataset."_
- _"Summarize the README for the clinical-trials package."_

### Claude Code

Add Quilt as a remote MCP server by running:

```bash
claude mcp add --transport sse quilt https://<connect-host>/mcp/platform
```

Or add it to your MCP configuration file (`~/.claude.json`):

```json
{
  "mcpServers": {
    "quilt": {
      "type": "sse",
      "url": "https://<connect-host>/mcp/platform"
    }
  }
}
```

The first time you connect, Claude Code will open a browser window for OAuth
authorization (see [Authorization](#authorization) below).

## Authorization

The first time an AI assistant connects to Quilt, you will be redirected to the
Quilt catalog authorization page at `/connect/authorize`. This page shows:

- The name of the AI client requesting access
- What the client is allowed to do (read access, scoped to your Quilt role)

Click **Continue** to grant access, or **Cancel** to deny it. After authorizing, the AI
assistant receives a session token scoped to your Quilt user — it cannot access data
beyond what your assigned Quilt role permits.

You do not need to re-authorize the same client unless your session expires.

## Admin Setup

> Connect Server requires Quilt Platform version 1.69 or later.

Connect Server is disabled by default. To enable it, set the `ConnectAllowedHosts`
CloudFormation parameter to a non-empty value.

### CloudFormation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ConnectAllowedHosts` | _(empty)_ | Comma-separated hostnames allowed as OAuth `redirect_uri`. Empty = Connect disabled. Set to your AI client domains (e.g. `claude.ai`). |
| `ConnectSecurityGroup` | _(empty)_ | Optional EC2 security group ID for Connect ALB IP allowlisting. Empty = allow all. |
| `CertificateArnConnect` | _(empty)_ | Optional ACM certificate ARN for the Connect ALB. Empty = reuses the main stack TLS certificate. |

### DNS Configuration

After deploying with Connect enabled, create a DNS alias record for your Connect
subdomain (typically `<stack-name>-connect.<your-domain>`):

| Route 53 Field | Value |
|----------------|-------|
| Record type | `A` (alias) |
| Alias target | `ConnectLoadBalancerDNSName` CloudFormation output |
| Hosted zone ID | `ConnectLoadBalancerCanonicalHostedZoneID` CloudFormation output |

The final Connect Server hostname is available in the `ConnectHost` CloudFormation
output. Share this URL with your users.

### IP Allowlisting (Optional)

To restrict which IP ranges can reach the Connect Server, create an EC2 security group
with inbound rules on port 443 for your trusted CIDR ranges, then pass the security
group ID as `ConnectSecurityGroup`. If omitted, the Connect ALB accepts traffic from
any IP.
