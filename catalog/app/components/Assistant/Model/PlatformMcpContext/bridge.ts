/**
 * Pure bridge logic: MCP types → Qurator types.
 *
 * Extracted from index.ts to keep this testable without React / Redux.
 */

import * as Eff from 'effect'

import * as Content from '../Content'
import * as Tool from '../Tool'

import type * as Client from './client'

/**
 * Permissive Effect schema for MCP tool inputs.
 *
 * The MCP server's JSON Schema (sent to Bedrock as the tool's `inputSchema`)
 * is authoritative. Server-side validation happens in FastMCP + Pydantic. We
 * don't try to decode inputs client-side — just pass them through.
 */
const AnyRecord = Eff.Schema.Record({
  key: Eff.Schema.String,
  value: Eff.Schema.Unknown,
})

const IMAGE_MIME_MAP: Record<string, Content.ImageFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export function mapContent(block: Client.McpContent): Content.ToolResultContentBlock {
  if (
    block.type === 'text' &&
    typeof (block as Client.McpContentText).text === 'string'
  ) {
    return Content.ToolResultContentBlock.Text({
      text: (block as Client.McpContentText).text,
    })
  }
  if (block.type === 'image') {
    const img = block as Client.McpContentImage
    const format = IMAGE_MIME_MAP[img.mimeType?.toLowerCase()]
    if (format) {
      return Content.ToolResultContentBlock.Image({ format, source: img.data })
    }
    return Content.ToolResultContentBlock.Text({
      text: `[image: ${img.mimeType ?? 'unknown'} — ${img.data.length} base64 chars]`,
    })
  }
  if (block.type === 'resource') {
    const res = block as Client.McpContentResource
    const text = res.resource.text ?? `[resource: ${res.resource.uri}]`
    return Content.ToolResultContentBlock.Text({ text })
  }
  // Unknown future content type — dump JSON so the LLM has something to read.
  return Content.ToolResultContentBlock.Text({
    text: `[unknown content block]\n${JSON.stringify(block)}`,
  })
}

function makeExecutor(
  client: Client.McpClient,
  mcpName: string,
): Tool.Executor<Record<string, unknown>> {
  return (args) =>
    Eff.Effect.tryPromise({
      try: () => client.callTool(mcpName, args),
      catch: (e) => (e instanceof Error ? e : new Error(`tool ${mcpName}: ${String(e)}`)),
    }).pipe(
      Eff.Effect.match({
        onSuccess: (result) => {
          const content = result.content.map(mapContent)
          return result.isError ? Tool.fail(...content) : Tool.succeed(...content)
        },
        onFailure: (e) =>
          Tool.fail(
            Content.ToolResultContentBlock.Text({ text: `${mcpName}: ${e.message}` }),
          ),
      }),
      Eff.Effect.map(Eff.Option.some),
    )
}

/**
 * Build a Qurator `Tool.Descriptor` from an MCP tool.
 *
 * We bypass `Tool.make()` because it runs Effect-Schema decoding over the
 * inputs — the JSON Schema from the server is authoritative for Bedrock, and
 * server-side FastMCP + Pydantic validates the actual call. We construct the
 * descriptor directly: permissive Effect schema for the type wrapper, the
 * MCP server's JSON Schema for Bedrock's tool config.
 */
export function buildTool(
  client: Client.McpClient,
  mcp: Client.McpToolDescriptor,
): Tool.Descriptor<Record<string, unknown>> {
  const effectJsonSchema = Tool.makeJSONSchema(AnyRecord)
  const schema = {
    ...effectJsonSchema,
    ...mcp.inputSchema,
    description: mcp.description ?? effectJsonSchema.description,
  }
  return {
    description: mcp.description,
    schema,
    executor: makeExecutor(client, mcp.name),
  }
}
