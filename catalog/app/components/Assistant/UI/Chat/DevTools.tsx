import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import {
  Clear as ClearIcon,
  Delete as DeleteIcon,
  GetApp as GetAppIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@material-ui/icons'

import JsonDisplay from 'components/JsonDisplay'
import * as AWS from 'utils/AWS'

import * as Model from '../../Model'

const useModelIdOverrideStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
}))

type ModelIdOverrideProps = Model.Assistant.API['devTools']['modelIdOverride']

function ModelIdOverride({ value, setValue }: ModelIdOverrideProps) {
  const classes = useModelIdOverrideStyles()
  const [customMode, setCustomMode] = React.useState(false)
  const [validationDialog, setValidationDialog] = React.useState<{
    open: boolean
    message: string
    severity: 'error' | 'warning' | 'success'
  }>({ open: false, message: '', severity: 'error' })
  const [isTestingModel, setIsTestingModel] = React.useState(false)

  const bedrockClient = AWS.Bedrock.useClient()

  const showValidationDialog = React.useCallback(
    (message: string, severity: 'error' | 'warning' | 'success') => {
      setValidationDialog({ open: true, message, severity })
    },
    [],
  )

  const handleCloseValidationDialog = React.useCallback(() => {
    setValidationDialog((prev) => ({ ...prev, open: false }))
  }, [])

  const validateAndSetValue = React.useCallback(
    async (modelId: string) => {
      const validation = Model.Assistant.validateModelId(modelId)

      if (!validation.isValid) {
        showValidationDialog(`Invalid Model ID: ${validation.error}`, 'error')
        return false
      }

      // Test ALL models (including preset ones) for real availability
      if (modelId && modelId.trim() !== '') {
        setIsTestingModel(true)
        try {
          const availability = await Model.Assistant.testModelAvailability(
            modelId,
            bedrockClient,
          )

          if (!availability.available) {
            showValidationDialog(
              availability.error || `Model "${modelId}" is not available.`,
              'error',
            )
            setIsTestingModel(false)
            return false
          }

          if (availability.error) {
            // Show warning but allow the value
            showValidationDialog(availability.error, 'warning')
          } else {
            // Show success for all tested models
            const isPresetModel = Model.Assistant.MODELS.some(
              (model) => model.id === modelId,
            )
            const message = isPresetModel
              ? `✅ Preset model "${modelId}" is available!`
              : `✅ Custom model "${modelId}" is available!`
            showValidationDialog(message, 'success')
          }
        } catch (error) {
          showValidationDialog(`Failed to test model "${modelId}": ${error}`, 'error')
          setIsTestingModel(false)
          return false
        }
        setIsTestingModel(false)
      } else if (validation.error) {
        // Show info for validation warnings
        showValidationDialog(validation.error, 'warning')
      }

      setValue(modelId)
      return true
    },
    [setValue, showValidationDialog, bedrockClient],
  )

  const handleModelIdChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Allow typing without validation
      setValue(event.target.value)
    },
    [setValue],
  )

  const handleModelIdKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement
        if (target && target.value !== undefined) {
          validateAndSetValue(target.value)
        }
      }
    },
    [validateAndSetValue],
  )

  const handleSelectChange = React.useCallback(
    (event: React.ChangeEvent<{ name?: string | undefined; value: unknown }>) => {
      const modelId = event.target.value as string
      validateAndSetValue(modelId)
    },
    [validateAndSetValue],
  )

  const handleTestModel = React.useCallback(() => {
    if (value) {
      validateAndSetValue(value)
    }
  }, [value, validateAndSetValue])

  const handleClear = React.useCallback(() => {
    setValue('')
    setCustomMode(false)
  }, [setValue])

  const handleToggleCustom = React.useCallback(() => {
    setCustomMode((prev) => {
      if (prev) {
        setValue('')
      }
      return !prev
    })
  }, [setValue])

  return (
    <div className={classes.root}>
      {customMode ? (
        <M.TextField
          label="Custom Bedrock Model ID"
          placeholder="Enter custom model ID (press Enter to test)"
          value={value}
          onChange={handleModelIdChange}
          onKeyDown={handleModelIdKeyDown}
          fullWidth
          disabled={isTestingModel}
          helperText={
            isTestingModel
              ? 'Testing model availability in AWS Bedrock...'
              : 'Enter a custom Bedrock model ID (press Enter to test availability)'
          }
          InputLabelProps={{ shrink: true }}
          InputProps={{
            endAdornment: (
              <M.InputAdornment position="end">
                {isTestingModel ? (
                  <M.CircularProgress size={20} />
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <M.IconButton
                      aria-label="Test model availability"
                      onClick={handleTestModel}
                      edge="end"
                      size="small"
                      disabled={!value || value.trim() === ''}
                    >
                      <M.Tooltip arrow title="Test model availability">
                        <CheckIcon />
                      </M.Tooltip>
                    </M.IconButton>
                    <M.IconButton
                      aria-label="Switch to preset models"
                      onClick={handleToggleCustom}
                      edge="end"
                      size="small"
                    >
                      <M.Tooltip arrow title="Switch to preset models">
                        <ClearIcon />
                      </M.Tooltip>
                    </M.IconButton>
                  </div>
                )}
              </M.InputAdornment>
            ),
          }}
        />
      ) : (
        <>
          <M.FormControl fullWidth>
            <M.InputLabel shrink>Bedrock Model</M.InputLabel>
            <M.Select
              value={value || Model.Assistant.DEFAULT_MODEL_ID}
              onChange={handleSelectChange}
              displayEmpty
            >
              {Model.Assistant.MODELS.map((model) => (
                <M.MenuItem key={model.id} value={model.id}>
                  <div>
                    <div>{model.name}</div>
                    {model.description && (
                      <M.Typography variant="caption" color="textSecondary">
                        {model.description}
                      </M.Typography>
                    )}
                  </div>
                </M.MenuItem>
              ))}
            </M.Select>
            <M.FormHelperText>
              Select a model or{' '}
              <M.Button
                variant="text"
                size="small"
                onClick={handleToggleCustom}
                style={{
                  textTransform: 'none',
                  padding: 0,
                  minWidth: 'auto',
                  verticalAlign: 'baseline',
                  fontSize: 'inherit',
                }}
              >
                enter custom model ID
              </M.Button>
            </M.FormHelperText>
          </M.FormControl>
          {value && value !== Model.Assistant.DEFAULT_MODEL_ID && (
            <M.IconButton
              aria-label="Reset to default"
              onClick={handleClear}
              size="small"
              style={{ marginLeft: 8 }}
            >
              <M.Tooltip arrow title="Reset to default">
                <ClearIcon />
              </M.Tooltip>
            </M.IconButton>
          )}
        </>
      )}
      <M.Dialog
        open={validationDialog.open}
        onClose={handleCloseValidationDialog}
        maxWidth="sm"
        fullWidth
      >
        <M.DialogTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {validationDialog.severity === 'error' && <ErrorIcon color="error" />}
            {validationDialog.severity === 'warning' && <ErrorIcon color="inherit" />}
            {validationDialog.severity === 'success' && (
              <CheckIcon style={{ color: '#4caf50' }} />
            )}
            {validationDialog.severity === 'error' && 'Invalid Model ID'}
            {validationDialog.severity === 'warning' && 'Model ID Information'}
            {validationDialog.severity === 'success' && 'Model Available'}
          </div>
        </M.DialogTitle>
        <M.DialogContent>
          <M.Typography>{validationDialog.message}</M.Typography>
        </M.DialogContent>
        <M.DialogActions>
          <M.Button
            onClick={handleCloseValidationDialog}
            color={validationDialog.severity === 'success' ? 'primary' : 'default'}
          >
            OK
          </M.Button>
        </M.DialogActions>
      </M.Dialog>
    </div>
  )
}

const useRecordingControlsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
  label: {
    ...t.typography.body2,
    flexGrow: 1,
    padding: t.spacing(0, 2),
  },
}))

type RecordingControlsProps = Model.Assistant.API['devTools']['recording']

function RecordingControls({ enabled, log, enable, clear }: RecordingControlsProps) {
  const classes = useRecordingControlsStyles()

  const handleToggleRecording = React.useCallback(() => {
    enable(!enabled)
  }, [enabled, enable])

  const handleDownload = React.useCallback(() => {
    const data = `[\n${log.join(',\n')}\n]`
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qurator-session-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [log])

  return (
    <div className={classes.root}>
      <M.Button
        onClick={handleToggleRecording}
        variant="contained"
        color="primary"
        size="small"
      >
        {enabled ? 'Stop' : 'Start'} Recording
      </M.Button>

      {(enabled || log.length > 0) && (
        <div className={classes.label}>
          {log.length > 0 ? `${log.length} item(s) recorded` : 'Recording...'}
        </div>
      )}

      {log.length > 0 && (
        <>
          <M.Button
            onClick={handleDownload}
            size="small"
            variant="outlined"
            startIcon={<GetAppIcon />}
          >
            Download Log
          </M.Button>
          <M.Button
            onClick={clear}
            size="small"
            variant="outlined"
            startIcon={<DeleteIcon />}
          >
            Clear Log
          </M.Button>
        </>
      )}
    </div>
  )
}

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
  },
  contents: {
    flexGrow: 1,
    overflow: 'auto',
  },
  json: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
}))

interface DevToolsProps {
  state: Model.Assistant.API['state']
  modelIdOverride: Model.Assistant.API['devTools']['modelIdOverride']
  recording: Model.Assistant.API['devTools']['recording']
}

export default function DevTools({ state, modelIdOverride, recording }: DevToolsProps) {
  const classes = useStyles()

  const context = Model.Context.useAggregatedContext()

  const prompt = React.useMemo(
    () =>
      Eff.Effect.runSync(
        Model.Conversation.constructPrompt(
          state.events.filter((e) => !e.discarded),
          context,
        ),
      ),
    [state, context],
  )

  return (
    <section className={classes.root}>
      <h1 className={classes.heading}>Qurator Developer Tools</h1>
      <div className={classes.contents}>
        <ModelIdOverride {...modelIdOverride} />
        <M.Divider />
        <RecordingControls {...recording} />
        <M.Divider />
        <JsonDisplay className={classes.json} name="Context" value={context} />
        <JsonDisplay className={classes.json} name="State" value={state} />
        <JsonDisplay className={classes.json} name="Prompt" value={prompt} />
      </div>
    </section>
  )
}
