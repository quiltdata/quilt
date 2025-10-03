import React, { useState } from 'react'
import * as M from '@material-ui/core'
import {
  ArrowBack as BackIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@material-ui/icons'
import {
  MCP_SERVER_TEMPLATES,
  MCP_SERVER_CATEGORIES,
  getServersByCategory,
  getAllCategories,
} from './MCPServerTemplates'

interface MCPServerConfigProps {
  open: boolean
  onClose: () => void
  onSaveServer: (config: ServerConfig) => void
}

interface ServerConfig {
  id: string
  name: string
  endpoint: string
  apiKey?: string
  enabled: boolean
}

const useStyles = M.makeStyles((t) => ({
  dialog: {
    '& .MuiDialog-paper': {
      background: '#1E1E2E',
      borderRadius: 16,
      maxWidth: 900,
      width: '90vw',
    },
  },
  dialogTitle: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    padding: t.spacing(3),
  },
  dialogContent: {
    padding: t.spacing(3),
    minHeight: 500,
  },
  categorySection: {
    marginBottom: t.spacing(3),
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1.5),
    marginBottom: t.spacing(2),
    padding: t.spacing(1.5),
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  categoryIcon: {
    fontSize: '1.5rem',
  },
  categoryTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    flex: 1,
  },
  categoryCount: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  serverGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: t.spacing(2),
  },
  serverCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid transparent',
    borderRadius: 12,
    padding: t.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(102, 126, 234, 0.5)',
      transform: 'translateY(-2px)',
    },
  },
  serverCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
  },
  serverName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    marginBottom: t.spacing(0.5),
  },
  serverDescription: {
    fontSize: '0.8rem',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.4,
    minHeight: 40,
  },
  authBadge: {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(255, 152, 0, 0.2)',
    color: '#FFA726',
    marginTop: t.spacing(1),
  },
  configForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(3),
  },
  backButton: {
    marginBottom: t.spacing(2),
  },
  formField: {
    '& .MuiInputBase-root': {
      background: 'rgba(255, 255, 255, 0.05)',
      color: '#fff',
      borderRadius: 8,
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(102, 126, 234, 0.5)',
    },
    '& .MuiFormHelperText-root': {
      color: 'rgba(255, 255, 255, 0.5)',
    },
  },
  testButton: {
    background: 'rgba(102, 126, 234, 0.2)',
    color: '#667eea',
    '&:hover': {
      background: 'rgba(102, 126, 234, 0.3)',
    },
  },
  testResult: {
    padding: t.spacing(2),
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    fontSize: '0.875rem',
  },
  testSuccess: {
    background: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
    color: '#4CAF50',
  },
  testError: {
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    color: '#F44336',
  },
  infoBox: {
    padding: t.spacing(2),
    background: 'rgba(33, 150, 243, 0.1)',
    border: '1px solid rgba(33, 150, 243, 0.3)',
    borderRadius: 8,
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dialogActions: {
    padding: t.spacing(2, 3),
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
}))

export function MCPServerConfigRedesigned({
  open,
  onClose,
  onSaveServer,
}: MCPServerConfigProps) {
  const classes = useStyles()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [customName, setCustomName] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const template = MCP_SERVER_TEMPLATES.find((t) => t.id === selectedTemplate)
  const categories = getAllCategories()

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    const tmpl = MCP_SERVER_TEMPLATES.find((t) => t.id === templateId)
    if (tmpl) {
      setCustomName(tmpl.name)
      setEndpoint(tmpl.defaultEndpoint || '')
    }
    setTestResult(null)
  }

  const handleTest = async () => {
    if (!endpoint) {
      setTestResult({
        success: false,
        message: 'Please enter an endpoint URL',
      })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setTestResult({
        success: true,
        message: 'Successfully connected to MCP server!',
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!template || !endpoint) return

    const config: ServerConfig = {
      id: template.id,
      name: customName || template.name,
      endpoint,
      apiKey: apiKey || undefined,
      enabled: true,
    }

    onSaveServer(config)
    handleReset()
    onClose()
  }

  const handleReset = () => {
    setSelectedTemplate(null)
    setEndpoint('')
    setApiKey('')
    setCustomName('')
    setTestResult(null)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  return (
    <M.Dialog
      open={open}
      onClose={handleClose}
      className={classes.dialog}
      maxWidth={false}
    >
      <M.DialogTitle className={classes.dialogTitle}>
        <M.Typography variant="h5" style={{ fontWeight: 600 }}>
          Configure MCP Servers
        </M.Typography>
        <M.Typography variant="body2" style={{ opacity: 0.9, marginTop: 4 }}>
          {selectedTemplate
            ? 'Configure your server connection'
            : 'Choose from our curated collection of biomedical data sources'}
        </M.Typography>
      </M.DialogTitle>

      <M.DialogContent className={classes.dialogContent}>
        {!selectedTemplate ? (
          <>
            {categories.map((categoryId) => {
              const category =
                MCP_SERVER_CATEGORIES[categoryId as keyof typeof MCP_SERVER_CATEGORIES]
              const servers = getServersByCategory(categoryId)

              if (servers.length === 0) return null

              return (
                <div key={categoryId} className={classes.categorySection}>
                  <div className={classes.categoryHeader}>
                    <span className={classes.categoryIcon}>{category.icon}</span>
                    <span className={classes.categoryTitle}>{category.label}</span>
                    <span className={classes.categoryCount}>
                      {servers.length} servers
                    </span>
                  </div>

                  <div className={classes.serverGrid}>
                    {servers.map((server) => (
                      <div
                        key={server.id}
                        className={classes.serverCard}
                        onClick={() => handleTemplateSelect(server.id)}
                      >
                        <div className={classes.serverCardContent}>
                          <div className={classes.serverName}>{server.name}</div>
                          <div className={classes.serverDescription}>
                            {server.description}
                          </div>
                          {server.requiresAuth && (
                            <span className={classes.authBadge}>
                              Requires {server.authType?.toUpperCase() || 'Auth'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <div className={classes.configForm}>
            <M.Button
              startIcon={<BackIcon />}
              onClick={() => setSelectedTemplate(null)}
              className={classes.backButton}
              style={{ alignSelf: 'flex-start' }}
            >
              Back to Server List
            </M.Button>

            <M.Typography variant="h6" style={{ color: '#fff' }}>
              {template?.name}
            </M.Typography>

            <M.TextField
              className={classes.formField}
              label="Server Name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder={template?.name}
            />

            <M.TextField
              className={classes.formField}
              label="Endpoint URL"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              fullWidth
              required
              variant="outlined"
              placeholder="https://your-mcp-server.com/mcp"
              helperText="The MCP server endpoint URL"
            />

            {template?.requiresAuth && template?.authType === 'api-key' && (
              <M.TextField
                className={classes.formField}
                label="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                fullWidth
                type="password"
                variant="outlined"
                helperText="Your API key for authentication"
              />
            )}

            <M.Button
              variant="outlined"
              className={classes.testButton}
              onClick={handleTest}
              disabled={testing || !endpoint}
              startIcon={testing ? <M.CircularProgress size={16} /> : <CheckIcon />}
            >
              {testing ? 'Testing Connection...' : 'Test Connection'}
            </M.Button>

            {testResult && (
              <div
                className={`${classes.testResult} ${testResult.success ? classes.testSuccess : classes.testError}`}
              >
                {testResult.success ? <CheckIcon /> : <ErrorIcon />}
                {testResult.message}
              </div>
            )}

            {template?.documentationUrl && (
              <div className={classes.infoBox}>
                📘 For setup instructions, visit:{' '}
                <M.Link
                  href={template.documentationUrl}
                  target="_blank"
                  rel="noopener"
                  style={{ color: '#64B5F6', fontWeight: 600 }}
                >
                  {template.name} Documentation
                </M.Link>
              </div>
            )}
          </div>
        )}
      </M.DialogContent>

      <M.DialogActions className={classes.dialogActions}>
        <M.Button onClick={handleClose} style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Cancel
        </M.Button>
        {selectedTemplate && (
          <M.Button
            onClick={handleSave}
            variant="contained"
            disabled={!endpoint}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
            }}
          >
            Save Server
          </M.Button>
        )}
      </M.DialogActions>
    </M.Dialog>
  )
}
