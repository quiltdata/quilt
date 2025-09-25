import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import {
  Clear as ClearIcon,
  Delete as DeleteIcon,
  GetApp as GetAppIcon,
} from '@material-ui/icons'

import JsonDisplay from 'components/JsonDisplay'

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

  const handleModelIdChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(event.target.value)
    },
    [setValue],
  )

  const handleClear = React.useCallback(() => {
    setValue('')
    setCustomMode(false)
  }, [setValue])

  const handleToggleCustom = React.useCallback(() => {
    setCustomMode((prev) => !prev)
    if (customMode) {
      setValue('')
    }
  }, [customMode, setValue])

  return (
    <div className={classes.root}>
      {customMode ? (
        <M.TextField
          label="Custom Bedrock Model ID"
          placeholder="Enter custom model ID"
          value={value}
          onChange={handleModelIdChange}
          fullWidth
          helperText="Enter a custom Bedrock model ID"
          InputLabelProps={{ shrink: true }}
          InputProps={{
            endAdornment: (
              <M.InputAdornment position="end">
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
              onChange={handleModelIdChange}
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
              <M.Link
                component="button"
                onClick={handleToggleCustom}
                style={{ verticalAlign: 'baseline' }}
              >
                enter custom model ID
              </M.Link>
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
