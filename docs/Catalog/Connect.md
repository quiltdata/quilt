<!-- markdownlint-disable-next-line first-line-h1 -->
> Connect Server requires Quilt Platform version 1.68 or later.

**Quilt Connect Server** is an identity provider and gateway that enables
external services to securely interact with your Quilt data and perform
actions on behalf of your users. Connect Server:

- Authenticates requests using your organization's identity provider
- Issues session tokens scoped to individual user permissions
- Routes requests to authorized services within your AWS environment

One such service is the [Platform MCP Server](MCP-Server.md), which lets
AI assistants interact with your Quilt data through natural language.

## Admin Setup

Connect Server is disabled by default. To enable it, set the
`ConnectAllowedHosts` CloudFormation parameter to a non-empty value.

### CloudFormation Parameters

<!-- markdownlint-disable line-length table-column-style -->
| Parameter               | Default       | Description |
| ----------------------- | ------------- | --------------------------------------------------- |
| `ConnectAllowedHosts`   | _(empty)_     | Comma-separated list of allowed OAuth redirect origins. Empty = disabled. See [Entry formats](#connectallowedhosts-entry-formats) below. |
| `ConnectSecurityGroup`  | _(empty)_     | Optional EC2 security group ID for Connect ALB IP allowlisting. Empty = allow all. |
| `CertificateArnConnect` | _(empty)_     | Optional ACM certificate ARN for the Connect ALB. Empty = reuses main stack TLS certificate. |
<!-- markdownlint-enable line-length table-column-style -->

#### `ConnectAllowedHosts` Entry Formats

Each comma-separated entry can be one of:

<!-- markdownlint-disable line-length -->
| Format | Example | Matches |
| --- | --- | --- |
| **Hostname** | `claude.ai` | `https://claude.ai/*` (HTTPS only) |
| **Custom scheme** | `cursor://` | `cursor://<any-host>/*` (for desktop apps with a custom URI scheme) |
| **Localhost** | `localhost` | `http://localhost:<any-port>/*` and `http://127.0.0.1:<any-port>/*` (HTTP only; either loopback enables both) |
<!-- markdownlint-enable line-length -->

Example covering web, desktop, and local clients:

```text
claude.ai, claude.com, cursor://, localhost
```

Entries are case-insensitive. Trailing dots on hostnames are ignored.
Network schemes (`http://`, `https://`, etc.) are not valid entries and are
silently ignored — use a bare hostname for HTTPS clients and a custom scheme
(`cursor://`) for desktop clients.

## DNS Configuration

After deploying with Connect enabled, create a DNS alias record for your
Connect subdomain (typically `<stack-name>-connect.<your-domain>`):

| Route 53 Field  | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Record type     | `A` (alias)                                             |
| Alias target    | `ConnectLoadBalancerDNSName` CloudFormation output      |
| Hosted zone ID  | `ConnectLoadBalancerCanonicalHostedZoneID` output       |

The final Connect Server hostname is available in the `ConnectHost`
CloudFormation output.

## IP Allowlisting (Optional)

To restrict which IP ranges can reach the Connect Server, create an EC2
security group with inbound rules on port 443 for your trusted CIDR ranges,
then pass the security group ID as `ConnectSecurityGroup`. If omitted, the
Connect ALB accepts traffic from any IP.
