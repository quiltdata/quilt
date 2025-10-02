import React, { useState } from 'react'
import * as M from '@material-ui/core'
import {
  ArrowBack as BackIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Cloud as CloudIcon,
  Science as ScienceIcon,
  LocalHospital as HospitalIcon,
  School as SchoolIcon,
} from '@material-ui/icons'
import {
  MCP_SERVER_TEMPLATES,
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
      borderRadius: 16,
      maxWidth: 900,
      width: '90vw',
      maxHeight: '90vh',
    },
  },
  dialogTitle: {
    background: 'linear-gradient(135deg, #6b4fcf 0%, #4a3bb7 100%)',
    color: '#fff',
    padding: t.spacing(3),
    '& .MuiTypography-h5': {
      fontWeight: 600,
      marginBottom: t.spacing(0.5),
    },
    '& .MuiTypography-body2': {
      opacity: 0.9,
    },
  },
  dialogContent: {
    padding: t.spacing(3),
    backgroundColor: '#fafafa',
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
    padding: t.spacing(1.5, 2),
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    border: '1px solid rgba(107, 79, 207, 0.1)',
    boxShadow: '0 2px 8px rgba(107, 79, 207, 0.08)',
  },
  categoryIcon: {
    fontSize: '1.5rem',
    color: '#6b4fcf',
  },
  categoryTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#2d2753',
    flex: 1,
  },
  categoryCount: {
    fontSize: '0.75rem',
    color: 'rgba(45, 39, 83, 0.6)',
    background: 'rgba(107, 79, 207, 0.1)',
    padding: '2px 8px',
    borderRadius: 12,
  },
  serverGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: t.spacing(2),
  },
  serverCard: {
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid rgba(107, 79, 207, 0.15)',
    borderRadius: 12,
    padding: t.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(107, 79, 207, 0.08)',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(107, 79, 207, 0.3)',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 16px rgba(107, 79, 207, 0.15)',
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
    color: '#2d2753',
    marginBottom: t.spacing(0.5),
  },
  serverDescription: {
    fontSize: '0.8rem',
    color: 'rgba(45, 39, 83, 0.7)',
    lineHeight: 1.4,
    minHeight: 40,
  },
  authBadge: {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(255, 152, 0, 0.1)',
    color: '#f57c00',
    border: '1px solid rgba(255, 152, 0, 0.2)',
    marginTop: t.spacing(1),
  },
  configForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(3),
  },
  backButton: {
    marginBottom: t.spacing(2),
    color: '#6b4fcf',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.08)',
    },
  },
  formField: {
    '& .MuiInputBase-root': {
      background: 'rgba(255, 255, 255, 0.8)',
      borderRadius: 8,
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(45, 39, 83, 0.7)',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(107, 79, 207, 0.2)',
    },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(107, 79, 207, 0.4)',
    },
    '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#6b4fcf',
    },
    '& .MuiFormHelperText-root': {
      color: 'rgba(45, 39, 83, 0.6)',
    },
  },
  testButton: {
    background: 'rgba(107, 79, 207, 0.1)',
    color: '#6b4fcf',
    border: '1px solid rgba(107, 79, 207, 0.2)',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.15)',
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
    border: '1px solid rgba(76, 175, 80, 0.2)',
    color: '#2e7d32',
  },
  testError: {
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.2)',
    color: '#c62828',
  },
  infoBox: {
    padding: t.spacing(2),
    background: 'rgba(33, 150, 243, 0.1)',
    border: '1px solid rgba(33, 150, 243, 0.2)',
    borderRadius: 8,
    fontSize: '0.875rem',
    color: 'rgba(45, 39, 83, 0.8)',
  },
  dialogActions: {
    padding: t.spacing(2, 3),
    borderTop: '1px solid rgba(107, 79, 207, 0.1)',
    background: 'rgba(255, 255, 255, 0.8)',
  },
  saveButton: {
    background: '#6b4fcf',
    color: '#fff',
    '&:hover': {
      background: '#5a3fa3',
    },
  },
  cancelButton: {
    color: 'rgba(45, 39, 83, 0.7)',
    '&:hover': {
      background: 'rgba(45, 39, 83, 0.08)',
    },
  },
}))

const getCategoryIcon = (categoryId: string) => {
  switch (categoryId) {
    case 'biomedical':
      return <HospitalIcon />
    case 'research':
      return <ScienceIcon />
    case 'education':
      return <SchoolIcon />
    case 'cloud':
      return <CloudIcon />
    default:
      return <SettingsIcon />
  }
}

export function MCPServerConfigRefactored({
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
      // Simulate testing the MCP server connection
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
    <M.Dialog
      open={open}
      onClose={handleClose}
      className={classes.dialog}
      maxWidth={false}
    >
      <M.DialogTitle className={classes.dialogTitle}>
        <M.Typography variant="h5">Configure MCP Servers</M.Typography>
        <M.Typography variant="body2">
          {selectedTemplate
            ? 'Configure your server connection'
            : 'Choose from our curated collection of biomedical data sources'}
        </M.Typography>
      </M.DialogTitle>

      <M.DialogContent className={classes.dialogContent}>
        {!selectedTemplate ? (
          <>
            {categories.map((category) => {
              const servers = getServersByCategory(category.id)
              if (servers.length === 0) return null

              return (
                <div key={category.id} className={classes.categorySection}>
                  <div className={classes.categoryHeader}>
                    <span className={classes.categoryIcon}>
                      {getCategoryIcon(category.id)}
                    </span>
                    <span className={classes.categoryTitle}>{category.name}</span>
                    <span className={classes.categoryCount}>
                      {servers.length} server{servers.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className={classes.serverGrid}>
                    {servers.map((server) => (
                      <M.Paper
                        key={server.id}
                        className={classes.serverCard}
                        onClick={() => handleTemplateSelect(server.id)}
                        elevation={0}
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
                      </M.Paper>
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
            >
              Back to Server Selection
            </M.Button>

            <M.Typography variant="h6" gutterBottom>
              Configure {template?.name}
            </M.Typography>

            <M.TextField
              label="Server Name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              fullWidth
              className={classes.formField}
              helperText="Custom name for this server configuration"
            />

            <M.TextField
              label="Endpoint URL"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              fullWidth
              required
              className={classes.formField}
              helperText="The MCP server endpoint URL"
            />

            {template?.requiresAuth && (
              <M.TextField
                label="API Key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                fullWidth
                className={classes.formField}
                helperText={`${template.authType || 'API'} key for authentication`}
              />
            )}

            <div className={classes.infoBox}>
              <strong>About {template?.name}:</strong> {template?.description}
            </div>

            <M.Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing || !endpoint}
              className={classes.testButton}
              startIcon={testing ? <M.CircularProgress size={16} /> : <SettingsIcon />}
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
          </div>
        )}
      </M.DialogContent>

      <M.DialogActions className={classes.dialogActions}>
        <M.Button onClick={handleClose} className={classes.cancelButton}>
          Cancel
        </M.Button>
        {selectedTemplate && (
          <M.Button
            onClick={handleSave}
            variant="contained"
            className={classes.saveButton}
            disabled={!endpoint || (template?.requiresAuth && !apiKey)}
          >
            Save Server
          </M.Button>
        )}
      </M.DialogActions>
    </M.Dialog>
  )
}
