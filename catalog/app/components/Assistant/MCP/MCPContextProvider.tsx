import * as Eff from 'effect'
/* eslint-disable no-console */
import * as React from 'react'
import * as redux from 'react-redux'

import * as Content from 'components/Assistant/Model/Content'
import * as Context from 'components/Assistant/Model/Context'
import * as Tool from 'components/Assistant/Model/Tool'
import { useAuthState, AuthState } from 'containers/NavBar/NavMenu'
import * as authSelectors from 'containers/Auth/selectors'
import * as authActions from 'containers/Auth/actions'
import defer from 'utils/defer'

import { mcpClient } from './Client'
import type { MCPTool, MCPToolResult } from './types'

// Role-to-Permission Mapping
const ROLE_PERMISSIONS = {
  'ReadWriteQuiltV2-sales-prod': {
    buckets: ['quilt-sandbox-bucket', 'nf-core-gallery'],
    permissions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
    scope: 'read write list delete',
  },
  'ReadQuiltV2-sales-prod': {
    buckets: ['quilt-sandbox-bucket', 'nf-core-gallery'],
    permissions: ['s3:GetObject', 's3:ListBucket'],
    scope: 'read list',
  },
  ReadWriteQuiltBucket: {
    buckets: ['quilt-sandbox-bucket', 'nf-core-gallery'],
    permissions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
    scope: 'read write list delete',
  },
  QuiltContributorRole: {
    buckets: ['quilt-sandbox-bucket', 'nf-core-gallery'],
    permissions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
    scope: 'read write list delete',
  },
  QuiltPresentationRole: {
    buckets: ['quilt-sandbox-bucket', 'nf-core-gallery'],
    permissions: ['s3:GetObject', 's3:ListBucket'],
    scope: 'read list',
  },
}

// Function to enhance JWT token with authorization claims
async function enhanceTokenWithAuthClaims(
  originalToken: string,
  state: any,
): Promise<string> {
  try {
    console.log('🔧 Enhancing token with authorization claims...')

    // Decode the original token
    const tokenParts = originalToken.split('.')
    if (tokenParts.length !== 3) {
      console.log('⚠️ Invalid JWT format, returning original token')
      return originalToken
    }

    const payload = JSON.parse(
      atob(tokenParts[1] + '='.repeat((4 - (tokenParts[1].length % 4)) % 4)),
    )
    console.log('🔍 Original token payload:', payload)

    // Get user roles from Redux state
    const userRoles = getUserRolesFromState(state)
    console.log('🔍 User roles from state:', userRoles)

    // Map roles to permissions
    const permissions = getUserPermissions(userRoles)
    const scope = getUserScope(userRoles)
    const buckets = getUserBuckets(userRoles)

    // Create enhanced payload
    const enhancedPayload = {
      ...payload,
      scope: scope,
      permissions: permissions,
      roles: userRoles,
      groups: ['quilt-users', 'mcp-users'],
      aud: 'quilt-mcp-server',
      iss: 'quilt-frontend-enhanced',
      buckets: buckets,
    }

    console.log('🔍 Enhanced token payload:', enhancedPayload)

    // Create new JWT (simplified - in production, use proper JWT library)
    const header = tokenParts[0]
    const enhancedPayloadB64 = btoa(JSON.stringify(enhancedPayload))
    const signature = tokenParts[2] // Keep original signature for now

    const enhancedToken = `${header}.${enhancedPayloadB64}.${signature}`

    console.log('✅ Token enhanced with authorization claims')
    return enhancedToken
  } catch (error) {
    console.error('❌ Failed to enhance token:', error)
    return originalToken
  }
}

// Get user roles from Redux state
function getUserRolesFromState(state: any): string[] {
  try {
    // Try to get roles from auth state
    const authState = state.auth
    if (authState && authState.user && authState.user.roles) {
      return authState.user.roles.map((role: any) => role.name)
    }

    // Fallback: try to get from user data
    const userData = state.user
    if (userData && userData.roles) {
      return userData.roles.map((role: any) => role.name)
    }

    // Default fallback roles
    console.log('⚠️ Could not extract roles from state, using default')
    return ['ReadWriteQuiltV2-sales-prod']
  } catch (error) {
    console.error('❌ Error extracting roles from state:', error)
    return ['ReadWriteQuiltV2-sales-prod']
  }
}

// Get user permissions based on roles
function getUserPermissions(roles: string[]): string[] {
  const allPermissions = new Set<string>()

  roles.forEach((role) => {
    const roleConfig = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]
    if (roleConfig) {
      roleConfig.permissions.forEach((perm) => allPermissions.add(perm))
    }
  })

  return Array.from(allPermissions)
}

// Get user scope based on roles
function getUserScope(roles: string[]): string {
  const allScopes = new Set<string>()

  roles.forEach((role) => {
    const roleConfig = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]
    if (roleConfig) {
      roleConfig.scope.split(' ').forEach((scope) => allScopes.add(scope))
    }
  })

  return Array.from(allScopes).join(' ')
}

// Get user buckets based on roles
function getUserBuckets(roles: string[]): string[] {
  const allBuckets = new Set<string>()

  roles.forEach((role) => {
    const roleConfig = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]
    if (roleConfig) {
      roleConfig.buckets.forEach((bucket) => allBuckets.add(bucket))
    }
  })

  return Array.from(allBuckets)
}

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
  const roleMapping: Record<string, string> = {
    ReadWriteQuiltBucket: 'ReadWriteQuiltV2-sales-prod',
    QuiltContributorRole: 'ReadWriteQuiltV2-sales-prod', // Map to the same role for now
    QuiltPresentationRole: 'ReadQuiltV2-sales-prod',
    // Add more mappings as needed
  }

  return roleMapping[quiltRoleName] || quiltRoleName
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
  const dispatch = redux.useDispatch()

  // Set up Redux token getter for automatic token retrieval
  React.useEffect(() => {
    const getReduxToken = async (): Promise<string | null> => {
      try {
        console.log('🔍 Redux token getter called...')
        const reduxState = store.getState()
        console.log('🔍 Redux state structure:', Object.keys(reduxState))

        const tokenData = authSelectors.tokens(reduxState)
        console.log('🔍 Token data from selector:', tokenData)

        if (!tokenData || !tokenData.token) {
          console.log('⚠️ No token data or token found')
          return null
        }

        // Check if token is expired (with 60 second buffer)
        const now = Math.floor(Date.now() / 1000)
        const exp = tokenData.exp
        console.log('🔍 Token expiration check:', { now, exp, expiresIn: exp - now })

        if (exp && exp < now + 60) {
          console.log('🔄 Redux token expired, triggering refresh...')
          // Trigger token refresh in Redux
          const { resolver, promise } = defer()
          dispatch(authActions.check({ refetch: false }, resolver))

          // Wait for refresh to complete
          await promise

          // Get refreshed token
          const newReduxState = store.getState()
          const newTokenData = authSelectors.tokens(newReduxState)
          console.log('🔍 Refreshed token data:', newTokenData)
          return newTokenData?.token || null
        }

        console.log('✅ Using valid Redux token')

        // Enhance token with authorization claims
        const enhancedToken = await enhanceTokenWithAuthClaims(
          tokenData.token,
          reduxState,
        )
        return enhancedToken
      } catch (error) {
        console.error('❌ Failed to get Redux access token:', error)
        return null
      }
    }

    // Set the Redux token getter on the MCP client
    console.log('🔧 Setting up Redux token getter for MCP client...')
    mcpClient.setReduxTokenGetter(getReduxToken)
    console.log('✅ Redux token getter set successfully')
  }, [store, dispatch])

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
