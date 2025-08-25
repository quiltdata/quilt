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

  const handleModelIdChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value)
    },
    [setValue],
  )

  const handleClear = React.useCallback(() => setValue(''), [setValue])

  return (
    <div className={classes.root}>
      <M.TextField
        label="Bedrock Model ID"
        placeholder={Model.Assistant.DEFAULT_MODEL_ID}
        value={value}
        onChange={handleModelIdChange}
        fullWidth
        helperText="Leave empty to use default"
        InputLabelProps={{ shrink: true }}
        InputProps={{
          endAdornment: value ? (
            <M.InputAdornment position="end">
              <M.IconButton
                aria-label="Clear model ID override"
                onClick={handleClear}
                edge="end"
                size="small"
              >
                <M.Tooltip arrow title="Clear model ID override">
                  <ClearIcon />
                </M.Tooltip>
              </M.IconButton>
            </M.InputAdornment>
          ) : null,
        }}
      />
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
