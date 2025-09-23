import * as Eff from 'effect'
// eslint-disable-next-line import/no-unresolved
import { Client } from '@modelcontextprotocol/sdk/client/index'
// eslint-disable-next-line import/no-unresolved
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp'

export interface MCPClient {
  readonly client: Client
  readonly serverUrl: string
  readonly isConnected: boolean
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const MCPClient = Eff.Data.case<MCPClient>()

export class MCPClientService extends Eff.Context.Tag('MCPClientService')<
  MCPClientService,
  {
    readonly connect: (serverUrl: string) => Eff.Effect.Effect<MCPClient, Error>
    readonly disconnect: (client: MCPClient) => Eff.Effect.Effect<void, Error>
    readonly listTools: (client: MCPClient) => Eff.Effect.Effect<readonly any[], Error>
    readonly callTool: (
      client: MCPClient,
      name: string,
      args: Record<string, any>,
    ) => Eff.Effect.Effect<any, Error>
  }
>() {}

export const MCPClientServiceLive = Eff.Layer.succeed(
  MCPClientService,
  MCPClientService.of({
    connect: (serverUrl: string) =>
      Eff.Effect.gen(function* () {
        const client = new Client({
          name: 'quilt-agent',
          version: '0.1.0',
        })

        const transport = new StreamableHTTPClientTransport(new URL(serverUrl))

        yield* Eff.Effect.tryPromise({
          try: () => client.connect(transport),
          catch: (error) => new Error(`Failed to connect to MCP server: ${error}`),
        })

        return MCPClient({
          client,
          serverUrl,
          isConnected: true,
        })
      }),

    disconnect: (mcpClient: MCPClient) =>
      Eff.Effect.gen(function* () {
        yield* Eff.Effect.tryPromise({
          try: () => mcpClient.client.close(),
          catch: (error) => new Error(`Failed to disconnect: ${error}`),
        })
      }),

    listTools: (mcpClient: MCPClient) =>
      Eff.Effect.gen(function* () {
        const result = yield* Eff.Effect.tryPromise({
          try: () => mcpClient.client.listTools(),
          catch: (error) => new Error(`Failed to list tools: ${error}`),
        })

        const tools = result.tools || []
        return tools
      }),

    callTool: (mcpClient: MCPClient, name: string, args: Record<string, any>) =>
      Eff.Effect.gen(function* () {
        const result = yield* Eff.Effect.tryPromise({
          try: () =>
            mcpClient.client.callTool({
              name,
              arguments: args,
            }),
          catch: (error) => new Error(`Failed to call tool ${name}: ${error}`),
        })

        return result
      }),
  }),
)

// Configuration for MCP servers
export const MCP_SERVERS = {
  // Remote fetch server for testing
  fetch: 'https://remote.mcpservers.org/fetch/mcp',
} as const

export type MCPServerName = keyof typeof MCP_SERVERS

export const getServerUrl = (name: MCPServerName): string => MCP_SERVERS[name]
