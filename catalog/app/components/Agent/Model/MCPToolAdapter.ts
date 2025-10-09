import * as Eff from 'effect'

import * as Content from './Content'
import * as MCPClient from './MCPClient'
import * as Tool from './Tool'

interface MCPTool {
  name: string
  description?: string
  inputSchema?: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

interface MCPToolResult {
  content?: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    uri?: string
  }>
  isError?: boolean
}

/**
 * Convert MCP tool schema to JSON Schema format
 */
function convertToolSchema(mcpTool: MCPTool): Eff.JSONSchema.JsonSchema7Root {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    description: mcpTool.description,
    properties: mcpTool.inputSchema?.properties || {},
    required: mcpTool.inputSchema?.required || [],
  }
}

/**
 * Convert MCP tool result to our Tool.Result format
 */
function convertMCPResultToToolResult(mcpResult: MCPToolResult): Tool.Result {
  const content: Content.ToolResultContentBlock[] = []

  if (mcpResult.content) {
    for (const item of mcpResult.content) {
      switch (item.type) {
        case 'text':
          if (item.text) {
            content.push(Content.ToolResultContentBlock.Text({ text: item.text }))
          }
          break
        case 'image':
          if (item.data && item.mimeType) {
            // Extract format from mimeType (e.g., "image/png" -> "png")
            const format = item.mimeType.split('/')[1] as Content.ImageFormat
            if (Content.IMAGE_FORMATS.includes(format)) {
              content.push(
                Content.ToolResultContentBlock.Image({
                  format,
                  source: item.data, // The base64 data string
                }),
              )
            }
          }
          break
        case 'resource':
          // For resources, we'll just show the URI as text for now
          if (item.uri) {
            content.push(
              Content.ToolResultContentBlock.Text({
                text: `Resource: ${item.uri}`,
              }),
            )
          }
          break
      }
    }
  }

  // If no content was generated, add a default message
  if (content.length === 0) {
    content.push(
      Content.ToolResultContentBlock.Text({
        text: 'Tool executed successfully (no output)',
      }),
    )
  }

  return Tool.Result({
    status: mcpResult.isError ? 'error' : 'success',
    content,
  })
}

/**
 * Load tools from an MCP server and convert them to our format
 */
export const loadToolsFromMCPServer = (
  mcpClient: MCPClient.MCPClient,
): Eff.Effect.Effect<Tool.Collection, Error, MCPClient.MCPClientService> =>
  Eff.Effect.gen(function* () {
    const mcpService = yield* MCPClient.MCPClientService

    const mcpTools = yield* mcpService.listTools(mcpClient)

    const toolCollection: Tool.Collection = {}

    for (const mcpTool of mcpTools as MCPTool[]) {
      // Create executor with service provided
      const executor = (params: any) =>
        Eff.Effect.gen(function* () {
          const service = yield* MCPClient.MCPClientService
          const result = yield* service.callTool(mcpClient, mcpTool.name, params).pipe(
            Eff.Effect.map((r) => {
              const toolResult = convertMCPResultToToolResult(r as MCPToolResult)
              return Eff.Option.some(toolResult)
            }),
            Eff.Effect.catchAll((error) =>
              Eff.Effect.succeed(
                Eff.Option.some(
                  Tool.Result({
                    status: 'error',
                    content: [
                      Content.ToolResultContentBlock.Text({
                        text: `Error executing tool: ${error}`,
                      }),
                    ],
                  }),
                ),
              ),
            ),
          )
          return result
        }).pipe(Eff.Effect.provide(MCPClient.MCPClientServiceLive))

      toolCollection[mcpTool.name] = {
        description: mcpTool.description,
        schema: convertToolSchema(mcpTool),
        executor,
      }
    }

    return toolCollection
  })
