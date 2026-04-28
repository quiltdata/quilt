import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import JsonDisplay from 'components/JsonDisplay'
import * as Actor from 'utils/Actor'
import { runtime } from 'utils/Effect'

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
                  <Icons.Clear />
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
            startIcon={<Icons.GetApp />}
          >
            Download Log
          </M.Button>
          <M.Button
            onClick={clear}
            size="small"
            variant="outlined"
            startIcon={<Icons.Delete />}
          >
            Clear Log
          </M.Button>
        </>
      )}
    </div>
  )
}

const useConnectorsPanelStyles = M.makeStyles((t) => ({
  connector: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
  heading: {
    ...t.typography.subtitle2,
  },
  hint: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    margin: t.spacing(0.5, 0, 0),
  },
  state: {
    ...t.typography.body2,
    margin: t.spacing(1, 0, 0),
  },
  stateOk: {
    color: t.palette.success.main,
  },
  stateWarn: {
    // `warning.main` is too light on the panel's paper background;
    // `warning.dark` reads cleanly.
    color: t.palette.warning.dark,
  },
  stateError: {
    color: t.palette.error.main,
  },
  separator: {
    color: t.palette.text.disabled,
    margin: t.spacing(0, 1),
  },
  // Mirrors the MessageAction pattern in Chat.tsx — plain clickable span,
  // hover bumps opacity to 1. Grey + 500 weight to read as an action
  // without the link blueness M.Link defaults to.
  action: {
    color: t.palette.text.secondary,
    cursor: 'pointer',
    fontWeight: 500,
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
  },
  error: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    margin: t.spacing(0.5, 0, 0),
    wordBreak: 'break-word',
  },
  contribution: {
    margin: t.spacing(2, 0, 0),
    padding: t.spacing(0, 2, 2),
  },
  empty: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    padding: t.spacing(2),
  },
}))

interface ConnectorPanelRowProps {
  connector: Model.Connectors.ConnectorRuntime
}

function ConnectorPanelRow({ connector }: ConnectorPanelRowProps) {
  const classes = useConnectorsPanelStyles()
  const state = Actor.useState(connector.state)
  const onRetry = React.useCallback(() => runtime.runFork(connector.retry), [connector])
  const onAck = React.useCallback(
    () => runtime.runFork(connector.acknowledge),
    [connector],
  )
  const stateLine = Model.Connectors.ConnectorState.$match(state, {
    Connecting: () => ({ text: 'Connecting…', cls: classes.stateWarn }),
    Ready: ({ tools }) => ({
      text: `Ready — ${Object.keys(tools).length} tools`,
      cls: classes.stateOk,
    }),
    Disconnected: ({ retrying }) => ({
      text: retrying ? 'Disconnected — reconnecting…' : 'Disconnected',
      cls: classes.stateWarn,
    }),
    Failed: ({ acked }) => ({
      text: acked ? 'Failed (acknowledged)' : 'Failed',
      cls: classes.stateError,
    }),
  })
  const error =
    state._tag === 'Failed' || state._tag === 'Disconnected' ? state.error : null
  // Hide `reconnect` while the lifecycle is auto-progressing — Connecting
  // (initial bootstrap) or Disconnected{retrying} (probe loop already
  // running). The button would either no-op or queue redundant work.
  const showRetry = !Model.Connectors.stateIsTransient(state)
  const showAck = state._tag === 'Failed' && !state.acked
  return (
    <div className={classes.connector}>
      <div className={classes.heading}>Connector: {connector.config.title}</div>
      {connector.config.hint && (
        <div className={classes.hint}>{connector.config.hint}</div>
      )}
      <div className={classes.state}>
        <span className={stateLine.cls}>{stateLine.text}</span>
        {showRetry && (
          <>
            <span className={classes.separator}>·</span>
            <span className={classes.action} onClick={onRetry}>
              reconnect
            </span>
          </>
        )}
        {showAck && (
          <>
            <span className={classes.separator}>·</span>
            <span className={classes.action} onClick={onAck}>
              acknowledge
            </span>
          </>
        )}
      </div>
      {error && (
        <div className={classes.error}>
          {error._tag}: {error.message}
          {error.cause && ` (${error.cause})`}
        </div>
      )}
    </div>
  )
}

interface ConnectorsPanelProps {
  connectors: Model.Connectors.ConnectorsService
}

/**
 * DevTools Connectors panel (D31; subsumes qhq-5d0.3). Shows per-connector
 * state with manual retry / ack handles and a live preview of the
 * `contextContribution` Effect output — exactly what the LLM would see
 * if a turn fired right now.
 */
function ConnectorsPanel({ connectors }: ConnectorsPanelProps) {
  const classes = useConnectorsPanelStyles()
  const all = Object.values(connectors.byId)

  const [contribution, setContribution] = React.useState<
    Partial<Model.Context.ContextShape>
  >(() => runtime.runSync(connectors.contextContribution))

  // Connectors only contribute when at least one is in a stable state
  // (Ready → tools + ready overview; Failed{acked} → unavailable
  // overview). All other states emit nothing, in which case the panel
  // shouldn't show an empty `{ tools: {}, messages: [] }` block.
  const hasContribution =
    Object.keys(contribution.tools ?? {}).length > 0 ||
    (contribution.messages ?? []).length > 0

  React.useEffect(() => {
    if (all.length === 0) return
    const fiber = runtime.runFork(
      Eff.Stream.runForEach(
        Eff.Stream.mergeAll(
          all.map((c) => c.state.changes),
          { concurrency: 'unbounded' },
        ),
        () =>
          Eff.Effect.tap(connectors.contextContribution, (c) =>
            Eff.Effect.sync(() => setContribution(c)),
          ),
      ),
    )
    return () => {
      runtime.runFork(Eff.Fiber.interrupt(fiber))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors])

  return (
    <>
      {all.length === 0 ? (
        <div className={classes.empty}>No connectors configured.</div>
      ) : (
        all.map((c) => <ConnectorPanelRow key={c.id} connector={c} />)
      )}
      {hasContribution && (
        <div className={classes.contribution}>
          <JsonDisplay name="contextContribution" value={contribution} />
        </div>
      )}
    </>
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
  connectors: Model.Assistant.API['connectors']
}

export default function DevTools({
  state,
  modelIdOverride,
  recording,
  connectors,
}: DevToolsProps) {
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
        <ConnectorsPanel connectors={connectors} />
        <M.Divider />
        <JsonDisplay className={classes.json} name="Context" value={context} />
        <JsonDisplay className={classes.json} name="State" value={state} />
        <JsonDisplay className={classes.json} name="Prompt" value={prompt} />
      </div>
    </section>
  )
}
