/**
 * Qurator Settings Component
 *
 * Comprehensive settings panel for customizing Qurator behavior,
 * including model selection and Bedrock inference configuration.
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import {
  Memory as ModelIcon,
  Speed as PerformanceIcon,
  Security as SafetyIcon,
  BugReport as BugReportIcon,
} from '@material-ui/icons'
import cfg from 'constants/config'

import * as Model from '../../Model'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  heading: {
    ...t.typography.h5,
    borderBottom: `1px solid ${t.palette.divider}`,
    lineHeight: '64px',
    paddingLeft: t.spacing(2),
    paddingRight: t.spacing(8),
  },
  contents: {
    flexGrow: 1,
    overflow: 'auto',
    padding: t.spacing(2),
  },
  section: {
    marginBottom: t.spacing(3),
  },
  sectionTitle: {
    ...t.typography.h6,
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    marginBottom: t.spacing(2),
    color: t.palette.primary.main,
  },
  sectionIcon: {
    fontSize: '20px',
  },
  setting: {
    marginBottom: t.spacing(2),
  },
  slider: {
    marginTop: t.spacing(2),
  },
  helperText: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
  },
  resetButton: {
    marginTop: t.spacing(1),
  },
  divider: {
    margin: t.spacing(3, 0),
  },
}))

interface SettingsProps {
  modelIdOverride: Model.Assistant.API['devTools']['modelIdOverride']
}

export default function Settings({ modelIdOverride }: SettingsProps) {
  const classes = useStyles()

  // Model selection state
  const [availableModels, setAvailableModels] = React.useState<string[]>([])
  const [loadingModels, setLoadingModels] = React.useState(true)

  // Bedrock inference configuration
  const [maxTokens, setMaxTokens] = React.useState(4096)
  const [temperature, setTemperature] = React.useState(1.0)
  const [topP, setTopP] = React.useState(0.999)
  const [topK, setTopK] = React.useState(250)
  const [stopSequences, setStopSequences] = React.useState<string>('')

  // MCP Debug logging
  const [mcpDebugLogging, setMcpDebugLogging] = React.useState(
    () => localStorage.getItem('mcp-debug-logging') === 'true',
  )

  // Listen for debug logging changes from console or other sources
  React.useEffect(() => {
    const handleDebugChange = (event: CustomEvent) => {
      setMcpDebugLogging(event.detail.enabled)
    }

    window.addEventListener('mcp-debug-changed', handleDebugChange as EventListener)
    return () => {
      window.removeEventListener('mcp-debug-changed', handleDebugChange as EventListener)
    }
  }, [])

  // Load available models
  React.useEffect(() => {
    const fetchModels = async () => {
      try {
        const bedrock = new (await import('aws-sdk/clients/bedrock')).default({
          region: cfg.region || 'us-east-1',
        })
        const response = await bedrock.listFoundationModels().promise()

        const conversationalModels = (response.modelSummaries || [])
          .filter((model) => {
            const id = model.modelId || ''
            return (
              id.includes('anthropic.claude') ||
              id.includes('claude') ||
              id.includes('amazon.nova') ||
              id.includes('nova') ||
              id.includes('ai21') ||
              id.includes('cohere') ||
              id.includes('meta.llama') ||
              id.includes('mistral')
            )
          })
          .map((model) => model.modelId || '')
          .filter(Boolean)
          .sort((a, b) => {
            const getScore = (model: string) => {
              if (model.includes('claude')) return 0
              if (model.includes('nova')) return 1
              return 2
            }
            const aScore = getScore(a)
            const bScore = getScore(b)
            return aScore === bScore ? a.localeCompare(b) : aScore - bScore
          })

        setAvailableModels(conversationalModels)
      } catch (error) {
        // Failed to fetch Bedrock models, using fallback list
        setAvailableModels([
          Model.Assistant.DEFAULT_MODEL_ID,
          'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
          'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
          'anthropic.claude-3-5-sonnet-20240620-v1:0',
          'us.amazon.nova-pro-v1:0',
          'us.amazon.nova-lite-v1:0',
          'meta.llama3-1-70b-instruct-v1:0',
          'mistral.mistral-large-2402-v1:0',
        ])
      } finally {
        setLoadingModels(false)
      }
    }

    fetchModels()
  }, [])

  const handleModelChange = React.useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      modelIdOverride.setValue(event.target.value as string)
    },
    [modelIdOverride],
  )

  const handleResetModel = React.useCallback(() => {
    modelIdOverride.setValue('')
  }, [modelIdOverride])

  const handleResetInference = React.useCallback(() => {
    setMaxTokens(4096)
    setTemperature(1.0)
    setTopP(0.999)
    setTopK(250)
    setStopSequences('')
  }, [])

  const handleToggleDebugLogging = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked
      setMcpDebugLogging(enabled)
      localStorage.setItem('mcp-debug-logging', enabled ? 'true' : 'false')

      // Dispatch a custom event to notify the MCP client
      window.dispatchEvent(new CustomEvent('mcp-debug-changed', { detail: { enabled } }))
    },
    [],
  )

  const displayModelValue = modelIdOverride.value || Model.Assistant.DEFAULT_MODEL_ID

  return (
    <section className={classes.root}>
      <h1 className={classes.heading}>Qurator Settings</h1>

      <div className={classes.contents}>
        {/* Model Selection */}
        <div className={classes.section}>
          <div className={classes.sectionTitle}>
            <ModelIcon className={classes.sectionIcon} />
            Model Selection
          </div>

          {loadingModels ? (
            <M.CircularProgress size={24} />
          ) : (
            <M.FormControl fullWidth className={classes.setting}>
              <M.InputLabel shrink>Bedrock Model</M.InputLabel>
              <M.Select
                value={displayModelValue}
                onChange={handleModelChange}
                displayEmpty
                fullWidth
              >
                <M.MenuItem value="">
                  <em>Default ({Model.Assistant.DEFAULT_MODEL_ID})</em>
                </M.MenuItem>
                {availableModels.map((modelId) => (
                  <M.MenuItem key={modelId} value={modelId}>
                    {modelId}
                    {modelId === Model.Assistant.DEFAULT_MODEL_ID && ' (Default)'}
                  </M.MenuItem>
                ))}
              </M.Select>
              <div className={classes.helperText}>
                Select a foundation model for Qurator to use
                {modelIdOverride.value && (
                  <>
                    {' • '}
                    <M.Link component="button" onClick={handleResetModel}>
                      Reset to default
                    </M.Link>
                  </>
                )}
              </div>
            </M.FormControl>
          )}
        </div>

        <M.Divider className={classes.divider} />

        {/* Inference Configuration */}
        <div className={classes.section}>
          <div className={classes.sectionTitle}>
            <PerformanceIcon className={classes.sectionIcon} />
            Inference Configuration
          </div>

          {/* Max Tokens */}
          <div className={classes.setting}>
            <M.Typography gutterBottom>
              Max Tokens: {maxTokens.toLocaleString()}
            </M.Typography>
            <M.Slider
              value={maxTokens}
              onChange={(_, value) => setMaxTokens(value as number)}
              min={256}
              max={8192}
              step={256}
              marks={[
                { value: 256, label: '256' },
                { value: 2048, label: '2K' },
                { value: 4096, label: '4K' },
                { value: 8192, label: '8K' },
              ]}
              valueLabelDisplay="auto"
              className={classes.slider}
            />
            <div className={classes.helperText}>
              Maximum number of tokens in the response
            </div>
          </div>

          {/* Temperature */}
          <div className={classes.setting}>
            <M.Typography gutterBottom>
              Temperature: {temperature.toFixed(2)}
            </M.Typography>
            <M.Slider
              value={temperature}
              onChange={(_, value) => setTemperature(value as number)}
              min={0}
              max={1}
              step={0.05}
              marks={[
                { value: 0, label: '0 (Focused)' },
                { value: 0.5, label: '0.5' },
                { value: 1, label: '1 (Creative)' },
              ]}
              valueLabelDisplay="auto"
              className={classes.slider}
            />
            <div className={classes.helperText}>
              Controls randomness. Lower = more focused, higher = more creative
            </div>
          </div>

          {/* Top P */}
          <div className={classes.setting}>
            <M.Typography gutterBottom>Top P: {topP.toFixed(3)}</M.Typography>
            <M.Slider
              value={topP}
              onChange={(_, value) => setTopP(value as number)}
              min={0}
              max={1}
              step={0.001}
              marks={[
                { value: 0.5, label: '0.5' },
                { value: 0.9, label: '0.9' },
                { value: 0.999, label: '0.999' },
              ]}
              valueLabelDisplay="auto"
              className={classes.slider}
            />
            <div className={classes.helperText}>
              Nucleus sampling threshold (recommended: 0.9-0.999)
            </div>
          </div>

          {/* Top K */}
          <div className={classes.setting}>
            <M.Typography gutterBottom>Top K: {topK}</M.Typography>
            <M.Slider
              value={topK}
              onChange={(_, value) => setTopK(value as number)}
              min={1}
              max={500}
              step={10}
              marks={[
                { value: 50, label: '50' },
                { value: 250, label: '250' },
                { value: 500, label: '500' },
              ]}
              valueLabelDisplay="auto"
              className={classes.slider}
            />
            <div className={classes.helperText}>
              Number of highest probability tokens to consider
            </div>
          </div>

          {/* Stop Sequences */}
          <div className={classes.setting}>
            <M.TextField
              label="Stop Sequences"
              value={stopSequences}
              onChange={(e) => setStopSequences(e.target.value)}
              fullWidth
              placeholder="</answer>, STOP, etc. (comma-separated)"
              helperText="Text sequences that will stop generation when encountered"
            />
          </div>

          <M.Button
            variant="outlined"
            size="small"
            onClick={handleResetInference}
            className={classes.resetButton}
          >
            Reset to Defaults
          </M.Button>
        </div>

        <M.Divider className={classes.divider} />

        {/* Safety & Guardrails */}
        <div className={classes.section}>
          <div className={classes.sectionTitle}>
            <SafetyIcon className={classes.sectionIcon} />
            Safety & Guardrails
          </div>

          <M.FormControlLabel
            control={<M.Switch defaultChecked />}
            label="Content filtering"
          />
          <div className={classes.helperText}>
            Enable Bedrock content filtering for harmful content
          </div>

          <M.FormControlLabel
            control={<M.Switch defaultChecked />}
            label="PII detection"
            style={{ marginTop: 12 }}
          />
          <div className={classes.helperText}>
            Detect and redact personally identifiable information
          </div>
        </div>

        <M.Divider className={classes.divider} />

        {/* Developer & Debug Tools */}
        <div className={classes.section}>
          <div className={classes.sectionTitle}>
            <BugReportIcon className={classes.sectionIcon} />
            Developer & Debug Tools
          </div>

          <M.FormControlLabel
            control={
              <M.Switch
                checked={mcpDebugLogging}
                onChange={handleToggleDebugLogging}
                color="primary"
              />
            }
            label="Enable MCP Debug Logging"
          />
          <div className={classes.helperText}>
            Logs detailed MCP tool call information to CloudWatch for troubleshooting.
            Enable this if you're experiencing issues or working with Quilt support.
            {mcpDebugLogging && ' (Debug mode is currently active)'}
          </div>

          {mcpDebugLogging && (
            <M.Paper
              variant="outlined"
              style={{
                padding: 12,
                marginTop: 12,
                backgroundColor: '#e3f2fd',
                borderColor: '#2196f3',
              }}
            >
              <M.Typography
                variant="body2"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <M.Icon style={{ fontSize: 16, color: '#2196f3' }}>info</M.Icon>
                <strong>Debug mode active</strong>
              </M.Typography>
              <M.Typography variant="caption" style={{ display: 'block', marginTop: 4 }}>
                Detailed tool call logs including parameters and responses are being sent
                to CloudWatch. This may slightly impact performance. Remember to disable
                when done troubleshooting.
              </M.Typography>
            </M.Paper>
          )}
        </div>

        <M.Divider className={classes.divider} />

        {/* Current Configuration Summary */}
        <div className={classes.section}>
          <M.Typography variant="subtitle2" gutterBottom>
            Current Configuration Summary
          </M.Typography>
          <M.Paper variant="outlined" style={{ padding: 16 }}>
            <M.Typography
              variant="body2"
              component="pre"
              style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}
            >
              {JSON.stringify(
                {
                  model: modelIdOverride.value || Model.Assistant.DEFAULT_MODEL_ID,
                  inferenceConfig: {
                    maxTokens,
                    temperature,
                    topP,
                    topK,
                    stopSequences: stopSequences
                      ? stopSequences.split(',').map((s) => s.trim())
                      : [],
                  },
                },
                null,
                2,
              )}
            </M.Typography>
          </M.Paper>
        </div>
      </div>
    </section>
  )
}
