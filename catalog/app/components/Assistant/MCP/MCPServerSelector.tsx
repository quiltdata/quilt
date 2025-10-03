import React, { useState, useEffect } from 'react'
import * as M from '@material-ui/core'
import { mcpClient } from './Client'

interface MCPServer {
  id: string
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'loading'
  endpoint?: string
  toolCount?: number
  version?: string
  tools?: Array<{
    name: string
    description: string
  }>
}

interface MCPServerSelectorProps {
  onConfigureServers?: () => void
}

const useStyles = M.makeStyles((t) => ({
  dropdown: {
    minWidth: 200,
    marginRight: t.spacing(1),
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: t.spacing(1),
    display: 'inline-block',
  },
  connected: {
    backgroundColor: '#4caf50',
  },
  disconnected: {
    backgroundColor: '#f44336',
  },
  loading: {
    backgroundColor: '#ff9800',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  serverInfo: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  toolCount: {
    fontSize: '0.75rem',
    color: t.palette.text.secondary,
    marginLeft: t.spacing(1),
  },
  addButton: {
    borderTop: `1px solid ${t.palette.divider}`,
    color: t.palette.primary.main,
    fontWeight: 600,
  },
  toolsList: {
    paddingLeft: t.spacing(4),
    fontSize: '0.875rem',
    color: t.palette.text.secondary,
  },
  expandIcon: {
    marginLeft: t.spacing(1),
    fontSize: '1rem',
  },
}))

export function MCPServerSelector({ onConfigureServers }: MCPServerSelectorProps) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [servers, setServers] = useState<MCPServer[]>([])
  const [selectedServer, setSelectedServer] = useState<string>('quilt')
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  useEffect(() => {
    // Initialize with Quilt MCP server
    loadServers()
  }, [])

  const loadServers = async () => {
    const quiltServer: MCPServer = {
      id: 'quilt',
      name: 'Quilt MCP',
      description: 'Main Quilt data platform tools',
      status: 'loading',
      endpoint:
        (window as any).QUILT_CATALOG_CONFIG?.mcpEndpoint ||
        'https://demo.quiltdata.com/mcp',
    }

    setServers([quiltServer])

    try {
      // Check Quilt MCP status and get tools
      if (mcpClient.hasSession()) {
        const tools = await mcpClient.listAvailableTools()
        const serverInfo = mcpClient.getServerInfo()
        quiltServer.status = 'connected'
        quiltServer.toolCount = tools.length
        quiltServer.version = serverInfo?.version
        quiltServer.tools = tools.map((t) => ({
          name: t.name,
          description: t.description || '',
        }))
      } else {
        await mcpClient.initialize()
        const tools = await mcpClient.listAvailableTools()
        const serverInfo = mcpClient.getServerInfo()
        quiltServer.status = 'connected'
        quiltServer.toolCount = tools.length
        quiltServer.version = serverInfo?.version
        quiltServer.tools = tools.map((t) => ({
          name: t.name,
          description: t.description || '',
        }))
      }
    } catch (error) {
      console.error('Failed to connect to Quilt MCP:', error)
      quiltServer.status = 'disconnected'
      quiltServer.toolCount = 0
    }

    setServers([quiltServer])

    // Load configured additional servers from localStorage
    const savedServers = localStorage.getItem('mcp-additional-servers')
    if (savedServers) {
      try {
        const additional = JSON.parse(savedServers) as MCPServer[]
        setServers((prev) => [...prev, ...additional])
      } catch (e) {
        console.error('Failed to load additional servers:', e)
      }
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setExpandedServer(null)
  }

  const handleSelectServer = (serverId: string) => {
    setSelectedServer(serverId)
  }

  const toggleExpandServer = (serverId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setExpandedServer(expandedServer === serverId ? null : serverId)
  }

  const handleAddServers = () => {
    handleClose()
    if (onConfigureServers) {
      onConfigureServers()
    }
  }

  const currentServer = servers.find((s) => s.id === selectedServer)

  return (
    <>
      <M.Tooltip title="MCP Servers">
        <M.Button
          size="small"
          onClick={handleClick}
          style={{ textTransform: 'none', minWidth: 'auto' }}
        >
          <span
            className={`${classes.statusIndicator} ${
              currentServer?.status === 'connected'
                ? classes.connected
                : currentServer?.status === 'loading'
                  ? classes.loading
                  : classes.disconnected
            }`}
          />
          <M.Typography variant="body2" style={{ marginRight: 4 }}>
            {currentServer?.name || 'No Server'}
          </M.Typography>
          {currentServer?.toolCount !== undefined && (
            <M.Chip
              size="small"
              label={`${currentServer.toolCount} tools`}
              style={{ height: 18, fontSize: '0.7rem' }}
            />
          )}
        </M.Button>
      </M.Tooltip>

      <M.Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: 400,
            width: '350px',
          },
        }}
      >
        <M.MenuItem disabled>
          <M.Typography variant="caption" color="textSecondary">
            MCP Servers
          </M.Typography>
        </M.MenuItem>
        <M.Divider />

        {servers.map((server) => (
          <React.Fragment key={server.id}>
            <M.MenuItem
              selected={selectedServer === server.id}
              onClick={() => handleSelectServer(server.id)}
            >
              <div className={classes.menuItem}>
                <div className={classes.serverInfo}>
                  <span
                    className={`${classes.statusIndicator} ${
                      server.status === 'connected'
                        ? classes.connected
                        : server.status === 'loading'
                          ? classes.loading
                          : classes.disconnected
                    }`}
                  />
                  <div>
                    <M.Typography variant="body2">{server.name}</M.Typography>
                    <M.Typography variant="caption" color="textSecondary">
                      {server.description}
                      {server.version && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: '0.6rem',
                            color: 'rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          v{server.version}
                        </span>
                      )}
                    </M.Typography>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {server.toolCount !== undefined && (
                    <M.Chip
                      size="small"
                      label={`${server.toolCount}`}
                      style={{ height: 20, fontSize: '0.7rem', marginRight: 4 }}
                    />
                  )}
                  {server.tools && server.tools.length > 0 && (
                    <M.IconButton
                      size="small"
                      onClick={(e) => toggleExpandServer(server.id, e)}
                    >
                      <M.Icon style={{ fontSize: '1rem' }}>
                        {expandedServer === server.id ? 'expand_less' : 'expand_more'}
                      </M.Icon>
                    </M.IconButton>
                  )}
                </div>
              </div>
            </M.MenuItem>

            {expandedServer === server.id && server.tools && (
              <M.MenuItem
                disabled
                style={{ paddingLeft: 32, paddingTop: 0, paddingBottom: 8 }}
              >
                <div style={{ width: '100%' }}>
                  <M.Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ fontWeight: 600 }}
                  >
                    Available Tools:
                  </M.Typography>
                  {server.tools.map((tool, idx) => (
                    <div key={idx} style={{ marginTop: 4 }}>
                      <M.Typography variant="caption" style={{ fontWeight: 500 }}>
                        • {tool.name}
                      </M.Typography>
                      {tool.description && (
                        <M.Typography
                          variant="caption"
                          color="textSecondary"
                          style={{ display: 'block', marginLeft: 12, fontSize: '0.7rem' }}
                        >
                          {tool.description}
                        </M.Typography>
                      )}
                    </div>
                  ))}
                </div>
              </M.MenuItem>
            )}
          </React.Fragment>
        ))}

        <M.Divider />
        <M.MenuItem onClick={handleAddServers} className={classes.addButton}>
          <M.Icon style={{ marginRight: 8 }}>add</M.Icon>
          Configure Additional Servers
        </M.MenuItem>
      </M.Menu>
    </>
  )
}
