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
import { DynamicAuthManager } from '../../../services/DynamicAuthManager'
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
 */
function constructRoleARN(roleName: string, accountId?: string): string {
  const defaultAccountId = '850787717197'
  const account = accountId || defaultAccountId
  return `arn:aws:iam::${account}:role/${roleName}`
}

/**
 * Map Quilt role names to actual AWS role names
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
 * Create tool descriptor from MCP tool
 */
function createDescriptor(tool: MCPTool): [string, MCPTool] {
  return [tool.name, tool]
}

/**
 * Describe tool for summary
 */
function describeTool(tool: MCPTool): string {
  return `- ${tool.name}: ${tool.description}`
}

/**
 * Enhanced MCP context state hook with DynamicAuthManager integration
 */
function useMCPContextState(): State {
  const [state, setState] = React.useState<State>(INITIAL_STATE)
  const store = redux.useStore()
  const dispatch = redux.useDispatch()

  // Initialize DynamicAuthManager
  React.useEffect(() => {
    let cancelled = false
    const authManager = new DynamicAuthManager(store)

    const getReduxToken = async (): Promise<string | null> => {
      try {
        const enhancedToken = await authManager.getCurrentToken()
        if (enhancedToken) return enhancedToken

        const reduxState = store.getState()
        const tokenData = authSelectors.tokens(reduxState)
        if (!tokenData?.token) return null

        const now = Math.floor(Date.now() / 1000)
        if (tokenData.exp && tokenData.exp < now + 60) {
          const { resolver, promise } = defer()
          dispatch(authActions.check({ refetch: false }, resolver))
          await promise
          const refreshedState = store.getState()
          return authSelectors.tokens(refreshedState)?.token || null
        }

        return tokenData.token
      } catch (error) {
        console.error('❌ Failed to obtain access token:', error)
        return null
      }
    }

    mcpClient.setReduxTokenGetter(getReduxToken)

    authManager
      .initialize()
      .then(() => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, authManager }))
        }
      })
      .catch((error) => {
        console.error('❌ Failed to initialize DynamicAuthManager:', error)
      })

    return () => {
      cancelled = true
    }
  }, [store, dispatch])

  // Role information hook
  function useRoleInfo() {
    const authState = useAuthState()

    React.useEffect(() => {
      try {
        const roleInfo = AuthState.match(
          {
            Ready: ({ user }) => {
              if (user) {
                const awsRoleName = mapRoleNameToAWSRole(user.role.name)
                const currentRole = {
                  name: awsRoleName,
                  arn: constructRoleARN(awsRoleName),
                }

                const availableRoles = user.roles.map((role: { name: string }) => {
                  const mappedAwsRoleName = mapRoleNameToAWSRole(role.name)
                  return {
                    name: mappedAwsRoleName,
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

        console.log(
          '🔄 MCPContextProvider: Updating MCP client with role info:',
          roleInfo,
        )
        mcpClient.setRoleInfo(roleInfo.currentRole, roleInfo.availableRoles)

        if (process.env.NODE_ENV === 'development') {
          console.log('✅ MCP Role Info Updated:', roleInfo)
        }
      } catch (error) {
        console.error('Failed to update MCP role information:', error)
        mcpClient.setRoleInfo(null, [])
      }
    }, [authState])
  }

  // Use role info
  useRoleInfo()

  // MCP connection initialization
  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setState((prev) => ({ ...prev, status: 'loading', error: undefined }))

      try {
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
        setState((prev) => ({ ...prev, status: 'error', error: error as Error }))
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export function useMCPContextStateValue() {
  return React.useContext(MCPContextStateCtx)
}

export function MCPContextProvider({ children }: React.PropsWithChildren<{}>) {
  const state = useMCPContextState()
  return (
    <MCPContextStateCtx.Provider value={state}>{children}</MCPContextStateCtx.Provider>
  )
}

export function useMCPTools() {
  const { tools, status, error } = useMCPContextStateValue()
  return { tools, status, error }
}

export function useMCPTool(name: string) {
  const { tools } = useMCPContextStateValue()
  return tools[name]
}

export async function executeMCPTool(
  name: string,
  args: Record<string, unknown>,
): Promise<MCPToolResult> {
  const tool = useMCPTool(name)
  if (!tool) {
    throw new Error(`Tool ${name} not found`)
  }
  return await mcpClient.executeTool(name, args)
}

export function useMCPAuthManager() {
  const { authManager } = useMCPContextStateValue()
  return authManager
}
