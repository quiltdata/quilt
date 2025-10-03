import React, { useState } from 'react'
import * as M from '@material-ui/core'

interface MCPServerTemplate {
  id: string
  name: string
  description: string
  icon?: string
  defaultEndpoint?: string
  requiresAuth: boolean
  authType?: 'api-key' | 'oauth' | 'none'
  documentationUrl?: string
}

const MCP_SERVER_TEMPLATES: MCPServerTemplate[] = [
  {
    id: 'benchling',
    name: 'Benchling MCP',
    description: 'Access Benchling notebook entries, DNA sequences, and lab data',
    icon: '🧬',
    requiresAuth: true,
    authType: 'api-key',
    documentationUrl: 'https://docs.benchling.com/api',
  },
  {
    id: 'pubmed',
    name: 'PubMed MCP',
    description: 'Search and retrieve scientific literature from PubMed/NCBI',
    icon: '📚',
    requiresAuth: false,
    authType: 'none',
  },
  {
    id: 'cellxgene',
    name: 'CellxGene MCP',
    description: 'Access single-cell genomics data from CellxGene',
    icon: '🧫',
    requiresAuth: false,
    authType: 'none',
  },
  {
    id: 'nextflow',
    name: 'Nextflow MCP',
    description: 'Manage and execute Nextflow bioinformatics workflows',
    icon: '⚗️',
    requiresAuth: true,
    authType: 'api-key',
  },
]

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
    minWidth: 600,
  },
  templateCard: {
    padding: t.spacing(2),
    marginBottom: t.spacing(2),
    cursor: 'pointer',
    border: `2px solid transparent`,
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: t.palette.primary.main,
      backgroundColor: t.palette.action.hover,
    },
  },
  selectedTemplate: {
    borderColor: t.palette.primary.main,
    backgroundColor: t.palette.action.selected,
  },
  templateIcon: {
    fontSize: '2rem',
    marginRight: t.spacing(2),
  },
  configForm: {
    marginTop: t.spacing(2),
  },
  formField: {
    marginBottom: t.spacing(2),
  },
  warningBox: {
    marginTop: t.spacing(2),
    padding: t.spacing(2),
    backgroundColor: t.palette.warning.light,
    borderRadius: 4,
  },
  testButton: {
    marginTop: t.spacing(1),
  },
  testResult: {
    marginTop: t.spacing(1),
    padding: t.spacing(1),
    borderRadius: 4,
    fontSize: '0.875rem',
  },
  success: {
    backgroundColor: t.palette.success.light,
    color: t.palette.success.contrastText,
  },
  error: {
    backgroundColor: t.palette.error.light,
    color: t.palette.error.contrastText,
  },
}))

export function MCPServerConfig({ open, onClose, onSaveServer }: MCPServerConfigProps) {
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
      // Simulate testing the MCP server connection
      // In a real implementation, this would make an actual connection attempt
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setTestResult({
        success: true,
        message: 'Successfully connected to MCP server! Ready to configure.',
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
    <M.Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <M.DialogTitle>
        <M.Typography variant="h6">Configure MCP Servers</M.Typography>
        <M.Typography variant="caption" color="textSecondary">
          Add additional MCP servers to extend Qurator's capabilities
        </M.Typography>
      </M.DialogTitle>

      <M.DialogContent className={classes.dialog}>
        {!selectedTemplate ? (
          <>
            <M.Typography variant="subtitle1" gutterBottom>
              Select a Server Template
            </M.Typography>
            {MCP_SERVER_TEMPLATES.map((tmpl) => (
              <M.Paper
                key={tmpl.id}
                className={classes.templateCard}
                onClick={() => handleTemplateSelect(tmpl.id)}
                elevation={1}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={classes.templateIcon}>{tmpl.icon}</span>
                  <div style={{ flex: 1 }}>
                    <M.Typography variant="h6">{tmpl.name}</M.Typography>
                    <M.Typography variant="body2" color="textSecondary">
                      {tmpl.description}
                    </M.Typography>
                    {tmpl.requiresAuth && (
                      <M.Chip
                        size="small"
                        label={`Requires ${tmpl.authType?.toUpperCase() || 'Auth'}`}
                        style={{ marginTop: 4 }}
                      />
                    )}
                  </div>
                  <M.Icon>chevron_right</M.Icon>
                </div>
              </M.Paper>
            ))}
          </>
        ) : (
          <div className={classes.configForm}>
            <M.Button
              size="small"
              startIcon={<M.Icon>arrow_back</M.Icon>}
              onClick={() => setSelectedTemplate(null)}
              style={{ marginBottom: 16 }}
            >
              Back to Templates
            </M.Button>

            <M.Typography variant="h6" gutterBottom>
              Configure {template?.name}
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
              className={classes.testButton}
              variant="outlined"
              onClick={handleTest}
              disabled={testing || !endpoint}
              startIcon={
                testing ? <M.CircularProgress size={16} /> : <M.Icon>check_circle</M.Icon>
              }
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </M.Button>

            {testResult && (
              <M.Paper
                className={`${classes.testResult} ${
                  testResult.success ? classes.success : classes.error
                }`}
              >
                <M.Icon
                  style={{ verticalAlign: 'middle', marginRight: 8, fontSize: '1rem' }}
                >
                  {testResult.success ? 'check_circle' : 'error'}
                </M.Icon>
                {testResult.message}
              </M.Paper>
            )}

            {template?.documentationUrl && (
              <M.Box className={classes.warningBox}>
                <M.Typography variant="body2">
                  <M.Icon
                    style={{ verticalAlign: 'middle', marginRight: 4, fontSize: '1rem' }}
                  >
                    info
                  </M.Icon>
                  For setup instructions, visit:{' '}
                  <M.Link href={template.documentationUrl} target="_blank" rel="noopener">
                    {template.name} Documentation
                  </M.Link>
                </M.Typography>
              </M.Box>
            )}
          </div>
        )}
      </M.DialogContent>

      <M.DialogActions>
        <M.Button onClick={handleClose}>Cancel</M.Button>
        {selectedTemplate && (
          <M.Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={!endpoint}
          >
            Save Server
          </M.Button>
        )}
      </M.DialogActions>
    </M.Dialog>
  )
}
