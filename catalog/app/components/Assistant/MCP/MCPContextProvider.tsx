import * as Eff from 'effect'
/* eslint-disable no-console */
import * as React from 'react'
import * as redux from 'react-redux'

import * as Content from 'components/Assistant/Model/Content'
import * as Context from 'components/Assistant/Model/Context'
import * as Tool from 'components/Assistant/Model/Tool'
import { useAuthState, AuthState } from 'containers/NavBar/NavMenu'

import { mcpClient } from './Client'
import type { MCPTool, MCPToolResult } from './types'
import {
  DynamicAuthManager,
  findTokenInState,
} from '../../../services/DynamicAuthManager'
import { resolveRoleName } from '../../../services/mcpAuthorization'

const JSON_SCHEMA_URL = 'https://json-schema.org/draft/2020-12/schema'

type Status = 'loading' | 'ready' | 'error'

interface State {
  status: Status
  tools: Tool.Collection
  summary: string
  error?: string
  authManager?: DynamicAuthManager
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

/**
 * Construct AWS ARN from role name
 * This constructs a standard IAM role ARN format
 */
function constructRoleARN(roleName: string, accountId?: string): string {
  // Default account ID - this should ideally come from configuration
  const defaultAccountId = '850787717197' // This should be configurable
  const account = accountId || defaultAccountId

  return `arn:aws:iam::${account}:role/${roleName}`
}

/**
 * Map Quilt role names to actual AWS role names
 * This handles the mismatch between Quilt's internal role names and AWS role names
 */
function mapRoleNameToAWSRole(quiltRoleName: string): string {
  const canonical = resolveRoleName(quiltRoleName)
  const roleMapping: Record<string, string> = {
    'ReadWriteQuiltV2-sales-prod': 'ReadWriteQuiltV2-sales-prod',
    ReadOnlyQuilt: 'ReadQuiltV2-sales-prod',
    AdminQuilt: 'AdminQuilt',
  }

  return roleMapping[canonical] || canonical
}

/**
 * Hook to extract role information from auth state and update MCP client
 */
function useRoleInfo() {
  const authState = useAuthState()

  React.useEffect(() => {
    try {
      // Extract role information from auth state using pattern matching
      const roleInfo = AuthState.match(
        {
          Ready: ({ user }) => {
            if (user) {
              // Map Quilt role name to actual AWS role name
              const awsRoleName = mapRoleNameToAWSRole(user.role.name)
              const currentRole = {
                name: awsRoleName, // Use the mapped AWS role name
                arn: constructRoleARN(awsRoleName),
              }

              const availableRoles = user.roles.map((role: { name: string }) => {
                const mappedAwsRoleName = mapRoleNameToAWSRole(role.name)
                return {
                  name: mappedAwsRoleName, // Use the mapped AWS role name
                  arn: constructRoleARN(mappedAwsRoleName),
                }
              })

              return { currentRole, availableRoles }
            }
            return { currentRole: null, availableRoles: [] }
          },
          Error: () => ({ currentRole: null, availableRoles: [] }),
          Loading: () => ({ currentRole: null, availableRoles: [] }),
        },
        authState,
      )

      // Update MCP client with role information
      console.log('🔄 MCPContextProvider: Updating MCP client with role info:', roleInfo)
      mcpClient.setRoleInfo(roleInfo.currentRole, roleInfo.availableRoles)

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ MCP Role Info Updated:', roleInfo)
      }
    } catch (error) {
      console.error('Failed to update MCP role information:', error)
      // Clear role information on error to prevent invalid state
      mcpClient.setRoleInfo(null, [])
    }
  }, [authState])
}

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
  const store = redux.useStore()

  // Initialize DynamicAuthManager
  const authManager = React.useMemo(
    () => new DynamicAuthManager(store), // reduxStore
    [store],
  )

  // Set up Redux token getter for automatic token retrieval
  React.useEffect(() => {
    const extractTokenFromStore = async (): Promise<string | null> => {
      try {
        console.log('🔍 MCP Client: Redux token getter called...')
        
        // Use DynamicAuthManager to get enhanced token
        const enhancedToken = await authManager.getCurrentToken()
        if (enhancedToken) {
          console.log('✅ MCP Client: Enhanced token generated by DynamicAuthManager')
          return enhancedToken
        }

        // Fallback: get original token directly from Redux
        console.log('⚠️ MCP Client: No enhanced token available, falling back to original Redux token')
        const reduxState = store.getState() as any
        const { token, source } = findTokenInState(reduxState)
        if (token) {
          console.log(`✅ MCP Client: Original token found in Redux state (${source})`)
          return token
        }

        const stateKeys =
          typeof reduxState?.keySeq === 'function'
            ? reduxState.keySeq().toArray()
            : Object.keys(reduxState || {})
        console.warn('⚠️ MCP Client: No bearer token found in Redux state', {
          keys: stateKeys,
        })
        return null
      } catch (error) {
        console.error('❌ MCP Client: Failed to get Redux access token:', error)
        return null
      }
    }

    // Create a simple Redux token getter for the auth manager (no circular dependency)
    const getReduxTokenForAuthManager = async (): Promise<string | null> => {
      try {
        const reduxState = store.getState() as any
        const { token } = findTokenInState(reduxState)
        return token
      } catch (error) {
        console.error('❌ AuthManager: Failed to get Redux token:', error)
        return null
      }
    }

    console.log('🔧 MCP Client: Setting up Redux token getter...')
    mcpClient.setReduxTokenGetter(extractTokenFromStore)
    authManager.tokenGetter = getReduxTokenForAuthManager
    console.log('✅ MCP Client: Redux token getter configured')
  }, [authManager, store])

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((prev) => ({ ...prev, status: 'loading', error: undefined, authManager }))

      try {
        // Use the working initialization pattern with DynamicAuthManager
        console.log('🔍 Initializing MCP connection with DynamicAuthManager...')

        if (!mcpClient.hasSession()) {
          await mcpClient.initialize()
        }

        const tools = await mcpClient.listAvailableTools()
        if (cancelled) return

        const collection = Object.fromEntries(tools.map(createDescriptor))
        const summary = tools.map(describeTool).join('\n')

        setState((prev) => ({
          ...prev,
          status: 'ready',
          tools: collection,
          summary,
        }))
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

        setState((prev) => ({
          ...prev,
          status: 'error',
          tools: {},
          summary: '',
          error: message,
        }))
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [authManager])

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

  // Update MCP client with role information
  useRoleInfo()

  // Expose authentication status for debugging
  React.useEffect(() => {
    const logAuthStatus = async () => {
      const authStatus = await mcpClient.getAuthenticationStatus()
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 MCP Authentication Status:', authStatus)
      }
    }
    logAuthStatus()
  }, [])

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
