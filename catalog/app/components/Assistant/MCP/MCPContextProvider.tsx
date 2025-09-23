import * as Eff from 'effect'
/* eslint-disable no-console */
import * as React from 'react'

import * as Content from 'components/Assistant/Model/Content'
import * as Context from 'components/Assistant/Model/Context'
import * as Tool from 'components/Assistant/Model/Tool'

import { mcpClient } from './Client'
import type { MCPTool, MCPToolResult } from './types'

const JSON_SCHEMA_URL = 'https://json-schema.org/draft/2020-12/schema'

type Status = 'loading' | 'ready' | 'error'

interface State {
  status: Status
  tools: Tool.Collection
  summary: string
  error?: string
  verification?: {
    endpoint: string
    reachable: boolean
    sseSupported: boolean
    mcpCompatible: boolean
    tools: number
    latency: number
    error?: string
  }
}

const INITIAL_STATE: State = {
  status: 'loading',
  tools: {},
  summary: '',
}

const MCPContextStateCtx = React.createContext<State>(INITIAL_STATE)

function mapResultContent(block: MCPToolResult['content'][number]) {
  if (!block) {
    return Content.ToolResultContentBlock.Text({ text: 'Empty result block' })
  }

  if (block.type === 'text' && block.text) {
    return Content.ToolResultContentBlock.Text({ text: block.text })
  }

  if (block.type === 'image_url' && block.image_url?.url) {
    return Content.ToolResultContentBlock.Text({
      text: `Image available at ${block.image_url.url}`,
    })
  }

  if (block.type === 'resource' && block.resource?.uri) {
    const mime = block.resource.mimeType ? ` (${block.resource.mimeType})` : ''
    return Content.ToolResultContentBlock.Text({
      text: `Resource available at ${block.resource.uri}${mime}`,
    })
  }

  return Content.ToolResultContentBlock.Text({
    text: `Unsupported MCP content block: ${JSON.stringify(block)}`,
  })
}

function toToolResult(toolName: string, result: MCPToolResult): Tool.Result {
  const contentBlocks = Array.isArray(result?.content)
    ? result.content.map(mapResultContent)
    : [
        Content.ToolResultContentBlock.Text({
          text: `Tool "${toolName}" completed without returning any content.`,
        }),
      ]

  return Tool.Result({
    status: result?.isError ? 'error' : 'success',
    content: contentBlocks,
  })
}

function describeTool(tool: MCPTool) {
  const description = tool.description ? `: ${tool.description}` : ''
  return `• ${tool.name}${description}`
}

function createDescriptor(tool: MCPTool): [string, Tool.Descriptor<any>] {
  const schema = {
    $schema: tool.inputSchema?.$schema ?? JSON_SCHEMA_URL,
    title: tool.inputSchema?.title ?? tool.name,
    type: 'object',
    properties: tool.inputSchema?.properties ?? {},
    required: (tool.inputSchema?.required ?? []) as ReadonlyArray<string>,
  } as unknown as Eff.JSONSchema.JsonSchema7Root

  const executor: Tool.Executor<Record<string, unknown>> = (args) =>
    Eff.Effect.tryPromise({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      try: async (_signal: AbortSignal) =>
        mcpClient.callTool({
          name: tool.name,
          arguments: (args ?? {}) as Record<string, unknown>,
        }),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    }).pipe(
      Eff.Effect.map((raw) => Eff.Option.some(toToolResult(tool.name, raw))),
      Eff.Effect.catchAll((error) =>
        Eff.Effect.succeed(
          Eff.Option.some(
            Tool.Result({
              status: 'error',
              content: [
                Content.ToolResultContentBlock.Text({
                  text: `MCP tool "${tool.name}" failed: ${error.message}`,
                }),
              ],
            }),
          ),
        ),
      ),
    )

  return [
    tool.name,
    {
      description: tool.description,
      schema,
      executor,
    },
  ]
}

function useMCPContextState(): State {
  const [state, setState] = React.useState<State>(INITIAL_STATE)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((prev) => ({ ...prev, status: 'loading', error: undefined }))

      try {
        // Use the working initialization pattern (same as MCPTestComponent)
        console.log('🔍 Initializing MCP connection...')

        if (!mcpClient.hasSession()) {
          await mcpClient.initialize()
        }

        const tools = await mcpClient.listAvailableTools()
        if (cancelled) return

        const collection = Object.fromEntries(tools.map(createDescriptor))
        const summary = tools.map(describeTool).join('\n')

        setState({
          status: 'ready',
          tools: collection,
          summary,
        })
      } catch (error) {
        if (cancelled) return
        let message = 'Failed to connect to MCP server'

        if (error instanceof Error) {
          if (
            error.message.includes('405 Not Allowed') ||
            error.message.includes('HTML response')
          ) {
            message = 'MCP server is currently unavailable. Please try again later.'
          } else if (error.message.includes('Invalid response format')) {
            message =
              'MCP server returned an unexpected response format. Please try again later.'
          } else {
            message = error.message
          }
        }

        setState({
          status: 'error',
          tools: {},
          summary: '',
          error: message,
        })
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export function useMCPStatus() {
  return React.useContext(MCPContextStateCtx).status
}

export function useMCPContextStateValue() {
  return React.useContext(MCPContextStateCtx)
}

export function MCPContextProvider({ children }: React.PropsWithChildren<{}>) {
  const state = useMCPContextState()

  const messages = React.useMemo(() => {
    if (state.status === 'ready') {
      const lines = [
        'MCP toolchain connected. The following tools are available for use via the Model Context Protocol:',
      ]

      if (state.summary) lines.push(state.summary)
      return lines
    }

    if (state.status === 'error' && state.error) {
      const lines = [`MCP toolchain unavailable: ${state.error}`]
      return lines
    }

    return []
  }, [state.status, state.summary, state.error])

  Context.usePushContext(
    React.useMemo(
      () => ({
        tools: state.tools,
        messages,
        markers: { 'mcp:ready': state.status === 'ready' },
      }),
      [state.tools, messages, state.status],
    ),
  )

  return (
    <MCPContextStateCtx.Provider value={state}>{children}</MCPContextStateCtx.Provider>
  )
}
