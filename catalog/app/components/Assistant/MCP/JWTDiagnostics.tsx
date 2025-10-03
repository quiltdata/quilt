/* eslint-disable no-console */
import * as React from 'react'
import * as M from '@material-ui/core'
import { Alert } from '@material-ui/lab'

import { useMCPContextStateValue } from './MCPContextProvider'
import { mcpClient } from './Client'

interface DiagnosticState {
  loading: boolean
  error?: string
  authStatus?: Awaited<ReturnType<typeof mcpClient.getAuthenticationStatus>>
  headers?: Record<string, string>
}

export function JWTDiagnostics() {
  const { status: clientStatus } = useMCPContextStateValue()
  const [state, setState] = React.useState<DiagnosticState>({ loading: true })

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [authStatus, headers] = await Promise.all([
          mcpClient.getAuthenticationStatus(),
          mcpClient.getHeaders().catch((error) => {
            console.warn('Unable to load MCP headers', error)
            return undefined
          }),
        ])

        if (!cancelled) {
          setState({
            loading: false,
            authStatus,
            headers,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <M.Paper elevation={3} style={{ padding: 16 }}>
      <M.Box display="flex" flexDirection="column" style={{ gap: 16 }}>
        <M.Typography variant="h6">Authentication Diagnostics</M.Typography>

        {clientStatus === 'loading' && (
          <Alert severity="info">Waiting for MCP client to initialise…</Alert>
        )}

        {state.loading && <Alert severity="info">Collecting token information…</Alert>}

        {state.error && <Alert severity="error">{state.error}</Alert>}

        {!state.loading && !state.error && state.authStatus && (
          <M.Box>
            <M.Typography variant="subtitle1">Auth Status</M.Typography>
            <M.List dense>
              <M.ListItem>
                <M.ListItemText
                  primary="Bearer token available"
                  secondary={state.authStatus.hasBearerToken ? 'Yes' : 'No'}
                />
              </M.ListItem>
              <M.ListItem>
                <M.ListItemText
                  primary="Authentication method"
                  secondary={state.authStatus.authenticationMethod}
                />
              </M.ListItem>
              <M.ListItem>
                <M.ListItemText
                  primary="Current role"
                  secondary={state.authStatus.currentRole?.name || 'Not set'}
                />
              </M.ListItem>
              <M.ListItem>
                <M.ListItemText
                  primary="Available roles"
                  secondary={
                    state.authStatus.availableRoles?.length
                      ? state.authStatus.availableRoles.map((r) => r.name).join(', ')
                      : 'None'
                  }
                />
              </M.ListItem>
            </M.List>
          </M.Box>
        )}

        {!state.loading && !state.error && state.headers && (
          <M.Box>
            <M.Typography variant="subtitle1">Outgoing MCP Headers</M.Typography>
            <pre style={{ fontSize: 12, margin: 0, padding: 12, background: '#f6f8fa' }}>
              {JSON.stringify(
                {
                  Authorization: state.headers.Authorization ? 'Bearer ***' : 'None',
                  ...state.headers,
                },
                null,
                2,
              )}
            </pre>
          </M.Box>
        )}

        {!state.loading && !state.error && !state.headers && (
          <Alert severity="warning">
            No MCP headers available yet. This usually means authentication has not
            completed.
          </Alert>
        )}
      </M.Box>
    </M.Paper>
  )
}

export default JWTDiagnostics
