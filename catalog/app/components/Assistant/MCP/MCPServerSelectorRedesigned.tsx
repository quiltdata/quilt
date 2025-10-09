import React, { useState, useEffect } from 'react'
import * as M from '@material-ui/core'
import { Settings as SettingsIcon } from '@material-ui/icons'
import { mcpClient } from './Client'

interface MCPServer {
  id: string
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'loading'
  endpoint?: string
  toolCount?: number
  tools?: Array<{
    name: string
    description: string
  }>
}

interface MCPServerSelectorProps {
  onConfigureServers?: () => void
}

const useStyles = M.makeStyles(() => ({
  selectorButton: {
    background: 'rgba(247, 244, 255, 0.92)',
    backdropFilter: 'blur(12px)',
    borderRadius: 10,
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid rgba(107, 79, 207, 0.25)',
    boxShadow: '0 6px 18px rgba(60, 42, 112, 0.12)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#2d2753',
    '&:hover': {
      background: 'rgba(241, 236, 255, 0.96)',
      boxShadow: '0 10px 22px rgba(60, 42, 112, 0.18)',
    },
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  connected: {
    backgroundColor: '#4CAF50',
    boxShadow: '0 0 8px rgba(76, 175, 80, 0.6)',
  },
  disconnected: {
    backgroundColor: '#F44336',
  },
  loading: {
    backgroundColor: '#FF9800',
    animation: '$pulse 2s ease-in-out infinite',
  },
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.5,
    },
  },
  serverName: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#2d2753',
    margin: 0,
  },
  toolBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#4a3bb7',
    background: 'rgba(107, 79, 207, 0.12)',
    borderRadius: 12,
    padding: '2px 10px',
    marginLeft: 4,
  },
  menu: {
    '& .MuiPaper-root': {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(18px)',
      borderRadius: 16,
      border: '1px solid rgba(210, 202, 244, 0.9)',
      boxShadow: '0 18px 45px rgba(48, 31, 116, 0.16)',
      maxWidth: 420,
      minWidth: 380,
    },
    '& .MuiList-root': {
      padding: 8,
    },
  },
  menuHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(210, 202, 244, 0.6)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#2d2753',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  serverItem: {
    borderRadius: 8,
    marginBottom: 4,
    padding: '12px 16px',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.08)',
    },
    '&.Mui-selected': {
      background: 'rgba(107, 79, 207, 0.18)',
      '&:hover': {
        background: 'rgba(107, 79, 207, 0.28)',
      },
    },
  },
  serverItemContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  serverIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(107, 79, 207, 0.08)',
    flexShrink: 0,
  },
  serverInfo: {
    flex: 1,
    minWidth: 0,
  },
  serverTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#2d2753',
    marginBottom: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  serverDescription: {
    fontSize: '0.75rem',
    color: 'rgba(45, 39, 83, 0.7)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolsCount: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #6b4fcf 0%, #8f6fff 100%)',
    borderRadius: 12,
    padding: '4px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  toolsList: {
    padding: '10px 18px 14px 64px',
    maxHeight: 200,
    overflow: 'auto',
    background: 'rgba(247, 244, 255, 0.6)',
    borderRadius: 12,
    margin: '4px 12px 12px',
  },
  toolItem: {
    padding: '8px 0',
    fontSize: '0.75rem',
    color: 'rgba(45, 39, 83, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderBottom: '1px solid rgba(210, 202, 244, 0.2)',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  toolName: {
    fontWeight: 600,
    color: '#6b4fcf',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
  },
  toolDescription: {
    fontSize: '0.7rem',
    color: 'rgba(45, 39, 83, 0.6)',
    lineHeight: 1.3,
  },
  configButton: {
    borderTop: '1px solid rgba(210, 202, 244, 0.8)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#6b4fcf',
    fontWeight: 500,
    fontSize: '0.875rem',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.12)',
    },
  },
  expandButton: {
    padding: 4,
    minWidth: 24,
    height: 24,
    color: 'rgba(74, 59, 183, 0.7)',
  },
}))

export function MCPServerSelectorRedesigned({
  onConfigureServers,
}: MCPServerSelectorProps) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [servers, setServers] = useState<MCPServer[]>([])
  const [selectedServer, setSelectedServer] = useState<string>('quilt')
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  useEffect(() => {
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
      if (mcpClient.hasSession()) {
        const tools = await mcpClient.listAvailableTools()
        quiltServer.status = 'connected'
        quiltServer.toolCount = tools.length
        quiltServer.tools = tools.map((t) => ({
          name: t.name,
          description: t.description || '',
        }))
      } else {
        await mcpClient.initialize()
        const tools = await mcpClient.listAvailableTools()
        quiltServer.status = 'connected'
        quiltServer.toolCount = tools.length
        quiltServer.tools = tools.map((t) => ({
          name: t.name,
          description: t.description || '',
        }))
      }
    } catch (error) {
      // Failed to connect to Quilt MCP
      quiltServer.status = 'disconnected'
      quiltServer.toolCount = 0
    }

    setServers([quiltServer])

    const savedServers = localStorage.getItem('mcp-additional-servers')
    if (savedServers) {
      try {
        const additional = JSON.parse(savedServers) as MCPServer[]
        setServers((prev) => [...prev, ...additional])
      } catch (e) {
        // Failed to load additional servers
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

  const currentServer = servers.find((s) => s.id === selectedServer)

  return (
    <>
      <button className={classes.selectorButton} onClick={handleClick}>
        <span
          className={`${classes.statusDot} ${
            currentServer?.status === 'connected'
              ? classes.connected
              : currentServer?.status === 'loading'
                ? classes.loading
                : classes.disconnected
          }`}
        />
        <p className={classes.serverName}>{currentServer?.name || 'No Server'}</p>
        {currentServer?.toolCount !== undefined && (
          <span className={classes.toolBadge}>{currentServer.toolCount} tools</span>
        )}
      </button>

      <M.Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        className={classes.menu}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        PaperProps={{
          style: {
            maxHeight: 500,
          },
        }}
      >
        <div className={classes.menuHeader}>
          <span className={classes.menuTitle}>MCP Servers</span>
        </div>

        {servers.map((server) => (
          <React.Fragment key={server.id}>
            <M.MenuItem
              className={classes.serverItem}
              selected={selectedServer === server.id}
              onClick={() => handleSelectServer(server.id)}
            >
              <div className={classes.serverItemContent}>
                <div className={classes.serverIcon}>
                  <span
                    className={`${classes.statusDot} ${
                      server.status === 'connected'
                        ? classes.connected
                        : server.status === 'loading'
                          ? classes.loading
                          : classes.disconnected
                    }`}
                  />
                </div>
                <div className={classes.serverInfo}>
                  <div className={classes.serverTitle}>{server.name}</div>
                  <div className={classes.serverDescription}>{server.description}</div>
                </div>
                {server.toolCount !== undefined && server.toolCount > 0 && (
                  <>
                    <span className={classes.toolsCount}>{server.toolCount}</span>
                    {server.tools && server.tools.length > 0 && (
                      <M.IconButton
                        className={classes.expandButton}
                        onClick={(e) => toggleExpandServer(server.id, e)}
                        size="small"
                      >
                        <M.Icon style={{ fontSize: 18 }}>
                          {expandedServer === server.id ? 'expand_less' : 'expand_more'}
                        </M.Icon>
                      </M.IconButton>
                    )}
                  </>
                )}
              </div>
            </M.MenuItem>

            {expandedServer === server.id && server.tools && server.tools.length > 0 && (
              <div className={classes.toolsList}>
                {server.tools.map((tool, idx) => (
                  <div key={idx} className={classes.toolItem}>
                    <span className={classes.toolName}>{tool.name}</span>
                    {tool.description && (
                      <span className={classes.toolDescription}>
                        {tool.description.length > 60
                          ? `${tool.description.substring(0, 60)}...`
                          : tool.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}

        <div
          className={classes.configButton}
          onClick={() => {
            handleClose()
            onConfigureServers?.()
          }}
        >
          <SettingsIcon style={{ fontSize: 18 }} />
          Configure Additional Servers
        </div>
      </M.Menu>
    </>
  )
}
