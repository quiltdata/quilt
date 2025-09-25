import * as React from 'react'
import * as M from '@material-ui/core'

import * as MCPClient from '../Model/MCPClient'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    padding: t.spacing(1, 2),
    borderRadius: t.spacing(0.5),
    backgroundColor: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(0.5),
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  connected: {
    backgroundColor: t.palette.success.main,
  },
  disconnected: {
    backgroundColor: t.palette.text.disabled,
  },
  error: {
    backgroundColor: t.palette.error.main,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(0.25),
  },
  serverName: {
    fontWeight: 'bold',
  },
  toolCount: {
    fontSize: '0.75rem',
    color: t.palette.text.secondary,
  },
}))

interface ServerStatusProps {
  mcpClient?: MCPClient.MCPClient | null
  toolCount?: number
  error?: string | null
  onReconnect?: () => void
}

export default function ServerStatus({
  mcpClient,
  toolCount = 0,
  error,
  onReconnect,
}: ServerStatusProps) {
  const classes = useStyles()

  const isConnected = mcpClient?.isConnected ?? false
  const hasError = !!error

  let statusClass = classes.disconnected
  let statusText = 'Disconnected'

  if (hasError) {
    statusClass = classes.error
    statusText = 'Error'
  } else if (isConnected) {
    statusClass = classes.connected
    statusText = 'Connected'
  }

  return (
    <div className={classes.root}>
      <div className={classes.status}>
        <div className={`${classes.indicator} ${statusClass}`} />
        <M.Typography variant="caption">{statusText}</M.Typography>
      </div>
      <div className={classes.info}>
        {mcpClient && (
          <>
            <span className={classes.serverName}>
              MCP: {mcpClient.serverUrl || 'Not configured'}
            </span>
            {isConnected && (
              <span className={classes.toolCount}>{toolCount} tools available</span>
            )}
          </>
        )}
        {!mcpClient && <span className={classes.serverName}>MCP: Not configured</span>}
        {error && (
          <M.Typography variant="caption" color="error">
            {error}
          </M.Typography>
        )}
      </div>
      {!isConnected && onReconnect && (
        <M.Button size="small" onClick={onReconnect}>
          Connect
        </M.Button>
      )}
    </div>
  )
}
