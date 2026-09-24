import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import Markdown from 'components/Markdown'
import * as Actor from 'utils/Actor'
import * as Buckets from 'utils/Buckets'
import { runtime } from 'utils/Effect'
import usePrevious from 'utils/usePrevious'

import * as Model from '../../Model'

import DevTools from './DevTools'
import Input from './Input'
import Instructions from './Instructions'
import MessageAction from './MessageAction'
import { toCurrentStack } from './links'

// `getRenderer` caches on the processor's identity and clears the whole cache at
// 16 entries, so every message must share one: a per-message identity would
// rebuild MarkdownIt and DOMPurify for each message on every render.
const PROCESS_LINK = new WeakMap<object, (href: string) => string>()

function useProcessLink() {
  const isInStack = Buckets.useIsInStack()
  return React.useMemo(() => {
    const cached = PROCESS_LINK.get(isInStack)
    if (cached) return cached
    const processLink = (href: string) =>
      toCurrentStack(href, window.location.origin, isInStack)
    PROCESS_LINK.set(isInStack, processLink)
    return processLink
  }, [isInStack])
}

const useMessageContainerStyles = M.makeStyles((t) => ({
  align_left: {},
  align_right: {},
  color_intense: {},
  color_normal: {},
  color_faint: {},
  messageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${t.spacing(0.5)}px`,
    '&$align_left': {
      alignItems: 'flex-start',
    },
    '&$align_right': {
      alignItems: 'flex-end',
    },
  },
  contentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '100%',
  },
  // Three registers, all from the theme: the user's turn on the chassis, the
  // answer on paper, tool calls as a quiet outlined card that is legible
  // without hovering.
  contentArea: {
    borderRadius: t.shape.borderRadius * 2,
    '$color_intense &': {
      background: t.palette.primary.main,
      color: t.palette.primary.contrastText,
    },
    '$color_normal &': {
      background: t.palette.background.paper,
      color: t.palette.text.primary,
    },
    '$color_faint &': {
      background: t.palette.background.paper,
      border: `1px solid ${t.palette.divider}`,
      color: t.palette.text.secondary,
    },
    '$align_right &': {
      borderBottomRightRadius: 0,
    },
    '$align_left &': {
      borderBottomLeftRadius: 0,
    },
  },
  contents: {
    ...t.typography.body2,
    padding: `${t.spacing(2)}px`,
  },
  footer: {
    ...t.typography.caption,
    color: t.palette.text.hint,
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'flex-end',
    paddingLeft: t.spacing(4),
    paddingTop: t.spacing(0.75),
  },
  actions: {
    color: t.palette.text.secondary,
    '$messageContainer:hover &, $messageContainer:focus-within &': {
      color: t.palette.text.primary,
    },
  },
}))

interface MessageContainerProps {
  color?: 'intense' | 'normal' | 'faint'
  align?: 'left' | 'right'
  children: React.ReactNode
  actions?: React.ReactNode
  timestamp?: Date
}

function MessageContainer({
  color = 'normal',
  align = 'left',
  children,
  actions,
  timestamp,
}: MessageContainerProps) {
  const classes = useMessageContainerStyles()
  return (
    <div
      className={cx(
        classes.messageContainer,
        classes[`align_${align}`],
        classes[`color_${color}`],
      )}
    >
      <div className={classes.contentWrapper}>
        <div className={classes.contentArea}>
          <div className={classes.contents}>{children}</div>
        </div>
        {!!(actions || timestamp) && (
          <div className={classes.footer}>
            {!!actions && <div className={classes.actions}>{actions}</div>}
            {timestamp && <span>{timestamp.toLocaleTimeString()}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const useToolMessageStyles = M.makeStyles((t) => ({
  // A real button: the whole row toggles, so it takes focus and the ring
  // (Focus Ring Rule) instead of an opacity dip on hover.
  header: {
    ...t.typography.body2,
    alignItems: 'center',
    borderRadius: t.shape.borderRadius,
    color: 'inherit',
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'flex-start',
    margin: t.spacing(-0.5, -1),
    padding: t.spacing(0.5, 1),
    width: `calc(100% + ${t.spacing(2)}px)`,
    '&:hover': {
      color: t.palette.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  icon: {
    fontSize: t.typography.body1.fontSize,
  },
  toolName: {
    flexGrow: 1,
    textAlign: 'left',
  },
  running: {
    color: t.palette.secondary.main,
  },
  success: {
    color: t.palette.success.main,
  },
  error: {
    color: t.palette.error.main,
  },
  details: {
    marginTop: t.spacing(1),
  },
}))

interface ConversationDispatchProps {
  dispatch: Model.Assistant.API['dispatch']
}

interface ConversationStateProps {
  state: Model.Conversation.State['_tag']
}

interface ToolMessageProps {
  name: string
  status?: 'success' | 'error' | 'running'
  details: Record<string, any>
  timestamp: Date
  actions?: React.ReactNode
}

function ToolMessage({ name, status, details, timestamp, actions }: ToolMessageProps) {
  const classes = useToolMessageStyles()
  const [expanded, setExpanded] = React.useState(false)

  const toggleExpanded = React.useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <MessageContainer color="faint" timestamp={timestamp} actions={actions}>
      <M.ButtonBase
        className={classes.header}
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <M.Icon className={classes.icon}>build</M.Icon>
        <span className={classes.toolName}>{name}</span>
        {status === 'success' && (
          <M.Icon className={cx(classes.icon, classes.success)} aria-label="Succeeded">
            check_circle_outline
          </M.Icon>
        )}
        {status === 'error' && (
          <M.Icon className={cx(classes.icon, classes.error)} aria-label="Failed">
            error_outline
          </M.Icon>
        )}
        {status === 'running' && (
          <M.CircularProgress
            size={14}
            thickness={4}
            className={classes.running}
            aria-label="Running"
          />
        )}
      </M.ButtonBase>
      <M.Collapse in={expanded}>
        <div className={classes.details}>
          <JsonDisplay defaultExpanded={2} name="details" value={details} />
        </div>
      </M.Collapse>
    </MessageContainer>
  )
}

type MessageEventProps = ConversationDispatchProps &
  ConversationStateProps &
  ReturnType<typeof Model.Conversation.Event.Message>

export function MessageEvent({
  state,
  id,
  timestamp,
  dispatch,
  role,
  content,
}: MessageEventProps) {
  const discard = React.useMemo(
    () =>
      state === 'Idle' ? () => dispatch(Model.Conversation.Action.Discard({ id })) : null,
    [dispatch, id, state],
  )

  // Only the assistant's links are retargeted: a host the user typed is a host
  // the user meant.
  const processLink = useProcessLink()
  const processAssistantLink = role === 'user' ? undefined : processLink

  return (
    <MessageContainer
      color={role === 'user' ? 'intense' : 'normal'}
      align={role === 'user' ? 'right' : 'left'}
      actions={discard && <MessageAction onClick={discard}>discard</MessageAction>}
      timestamp={timestamp}
    >
      {Model.Content.MessageContentBlock.$match(content, {
        Text: ({ text }) => <Markdown data={text} processLink={processAssistantLink} />,
        Image: ({ format }) => `${format} image`,
        Document: ({ name, format }) => `${format} document "${name}"`,
      })}
    </MessageContainer>
  )
}

type ToolUseEventProps = ConversationDispatchProps &
  ConversationStateProps &
  ReturnType<typeof Model.Conversation.Event.ToolUse>

function ToolUseEvent({
  state,
  id,
  timestamp,
  toolUseId,
  name,
  input,
  result,
  dispatch,
}: ToolUseEventProps) {
  const discard = React.useMemo(
    () =>
      state === 'Idle' ? () => dispatch(Model.Conversation.Action.Discard({ id })) : null,
    [dispatch, id, state],
  )
  const details = React.useMemo(
    () => ({ toolUseId, input, result }),
    [toolUseId, input, result],
  )
  return (
    <ToolMessage
      name={name}
      status={result.status}
      details={details}
      timestamp={timestamp}
      actions={discard && <MessageAction onClick={discard}>discard</MessageAction>}
    />
  )
}

interface ToolUseStateProps extends ConversationDispatchProps {
  timestamp: Date
  calls: Model.Conversation.ToolCalls
}

function ToolUseState({ timestamp, dispatch, calls }: ToolUseStateProps) {
  const abort = React.useCallback(
    () => dispatch(Model.Conversation.Action.Abort()),
    [dispatch],
  )

  const details = React.useMemo(
    () => Eff.Record.map(calls, Eff.Struct.pick('name', 'input')),
    [calls],
  )

  const names = Eff.Record.collect(calls, (_k, v) => v.name)

  return (
    <ToolMessage
      name={names.join(', ')}
      status="running"
      details={details}
      timestamp={timestamp}
      actions={<MessageAction onClick={abort}>abort</MessageAction>}
    />
  )
}

interface WaitingStateProps extends ConversationDispatchProps {
  timestamp: Date
}

const useWaitingStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  spinner: {
    color: 'inherit',
  },
}))

function WaitingState({ timestamp, dispatch }: WaitingStateProps) {
  const classes = useWaitingStyles()
  const abort = React.useCallback(
    () => dispatch(Model.Conversation.Action.Abort()),
    [dispatch],
  )
  return (
    <MessageContainer
      timestamp={timestamp}
      actions={<MessageAction onClick={abort}>abort</MessageAction>}
    >
      <span className={classes.root}>
        <M.CircularProgress size={14} thickness={4} className={classes.spinner} />
        Thinking…
      </span>
    </MessageContainer>
  )
}

// The error is content, not chrome: it renders as a message in the
// conversation, but wears the semantic error pair (icon + colored heading,
// never color alone) so it cannot be mistaken for an answer.
const useErrorStyles = M.makeStyles((t) => ({
  heading: {
    alignItems: 'center',
    color: t.palette.error.dark,
    display: 'flex',
    fontWeight: t.typography.fontWeightMedium,
    gap: t.spacing(0.5),
  },
  icon: {
    fontSize: t.typography.body1.fontSize,
  },
  details: {
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
  },
}))

interface ErrorStateProps {
  message: string
  details: string
  timestamp: Date
}

function ErrorState({ message, details, timestamp }: ErrorStateProps) {
  const classes = useErrorStyles()
  return (
    <MessageContainer timestamp={timestamp}>
      <div className={classes.heading}>
        <M.Icon className={classes.icon}>error_outline</M.Icon>
        {message}
      </div>
      <div className={classes.details}>{details}</div>
    </MessageContainer>
  )
}

function AwaitingConnectorState({ timestamp, dispatch }: WaitingStateProps) {
  const abort = React.useCallback(
    () => dispatch(Model.Conversation.Action.Abort()),
    [dispatch],
  )
  return (
    <MessageContainer
      timestamp={timestamp}
      actions={<MessageAction onClick={abort}>abort</MessageAction>}
    >
      Waiting for connectors…
    </MessageContainer>
  )
}

interface MenuProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  onToggleDevTools: () => void
  devToolsOpen: boolean
  className?: string
}

function Menu({ state, dispatch, devToolsOpen, onToggleDevTools, className }: MenuProps) {
  const [menuOpen, setMenuOpen] = React.useState<HTMLElement | null>(null)

  const isIdle = state._tag === 'Idle'

  const toggleMenu = React.useCallback(
    (e: React.BaseSyntheticEvent) =>
      setMenuOpen((prev) => (prev ? null : e.currentTarget)),
    [setMenuOpen],
  )
  const closeMenu = React.useCallback(() => setMenuOpen(null), [setMenuOpen])

  const startNewSession = React.useCallback(() => {
    if (isIdle) dispatch(Model.Conversation.Action.Clear())
    closeMenu()
  }, [closeMenu, isIdle, dispatch])

  const showDevTools = React.useCallback(() => {
    onToggleDevTools()
    closeMenu()
  }, [closeMenu, onToggleDevTools])

  return (
    <>
      <M.Fade in={!devToolsOpen}>
        <M.IconButton
          aria-label="Qurator menu"
          aria-haspopup="true"
          onClick={toggleMenu}
          className={className}
        >
          <M.Icon>menu</M.Icon>
        </M.IconButton>
      </M.Fade>
      <M.Fade in={devToolsOpen}>
        <M.Tooltip title="Close Developer Tools">
          <M.IconButton
            aria-label="close"
            onClick={onToggleDevTools}
            className={className}
          >
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </M.Tooltip>
      </M.Fade>
      <M.Menu anchorEl={menuOpen} open={!!menuOpen} onClose={closeMenu}>
        <M.MenuItem onClick={startNewSession} disabled={!isIdle}>
          New session
        </M.MenuItem>
        <M.MenuItem onClick={showDevTools}>Developer Tools</M.MenuItem>
      </M.Menu>
    </>
  )
}

const useConnectorHelperStyles = M.makeStyles((t) => ({
  action: {
    fontWeight: 500,
    marginLeft: t.spacing(0.5),
  },
  separator: {
    color: t.palette.text.disabled,
    margin: t.spacing(0, 0.5),
  },
}))

interface ConnectorHelperLineProps {
  connector: Model.Connectors.ConnectorRuntime
  state: Model.Connectors.ConnectorState
}

export function ConnectorHelperLine({ connector, state }: ConnectorHelperLineProps) {
  const classes = useConnectorHelperStyles()
  const onRetry = React.useCallback(() => runtime.runFork(connector.retry), [connector])
  const onAck = React.useCallback(
    () => runtime.runFork(connector.acknowledge),
    [connector],
  )
  const reconnect = (
    <MessageAction className={classes.action} onClick={onRetry}>
      reconnect
    </MessageAction>
  )
  const ack = (
    <MessageAction className={classes.action} onClick={onAck}>
      continue without
    </MessageAction>
  )
  const sep = <span className={classes.separator}>•</span>
  const title = connector.config.title
  return Model.Connectors.ConnectorState.$match(state, {
    Connecting: () => <>{title}: connecting…</>,
    Ready: () => null,
    Disconnected: () => <>{title}: reconnecting…</>,
    Failed: ({ acked }) =>
      acked ? (
        <>
          {title}: unavailable {sep} {reconnect}
        </>
      ) : (
        <>
          {title}: couldn’t connect {sep} {reconnect} {sep} {ack}
        </>
      ),
  })
}

const helperSeverityFor = (
  states: readonly Model.Connectors.ConnectorState[],
): 'warning' | 'error' | undefined => {
  if (states.some(Model.Connectors.stateRequiresAck)) return 'error'
  if (states.some(Model.Connectors.stateIsUnready)) return 'warning'
  return undefined
}

const useStyles = M.makeStyles((t) => ({
  chat: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
  // Qurator's identity line: the amber-bordered mark (a stroke and a glyph,
  // never an amber wash — same treatment as the front door's QuratorPanel)
  // plus a quiet provenance readout. Surface white with a hairline, so the
  // chat reads as one instrument with a labeled face.
  header: {
    alignItems: 'center',
    background: t.palette.background.paper,
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexShrink: 0,
    gap: t.spacing(1),
    minHeight: 56,
    // right padding clears the absolutely positioned menu button
    padding: t.spacing(1, 8, 1, 2),
  },
  qicon: {
    alignItems: 'center',
    border: `1px solid ${t.palette.secondary.main}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.secondary.main,
    display: 'grid',
    flexShrink: 0,
    height: t.spacing(4),
    placeItems: 'center',
    width: t.spacing(4),
  },
  qiconGlyph: {
    fontSize: t.typography.body1.fontSize,
  },
  title: {
    fontSize: t.typography.body1.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: 1.3,
  },
  subtitle: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    lineHeight: 1.3,
  },
  // Sits inside the header's reserved right gutter, left of the menu button.
  close: {
    marginLeft: 'auto',
    // The Focus Ring Rule (DESIGN.md §2), light half: midnight on white.
    '&&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  menu: {
    position: 'absolute',
    right: t.spacing(1),
    top: t.spacing(1),
    zIndex: 1,
  },
  devTools: {
    height: '50%',
    position: 'relative',
  },
  historyContainer: {
    flexGrow: 1,
    overflowY: 'auto',
  },
  history: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${t.spacing(2)}px`,
    justifyContent: 'flex-end',
    minHeight: '100%',
    padding: `${t.spacing(3)}px`,
    paddingBottom: 0,
  },
  connectorLine: {
    display: 'block',
  },
}))

interface ChatProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  devTools: Model.Assistant.API['devTools']
  connectors: Model.Assistant.API['connectors']
  instructions: Model.Assistant.API['instructions']
  onClose: () => void
}

export default function Chat({
  state,
  dispatch,
  devTools,
  connectors,
  instructions,
  onClose,
}: ChatProps) {
  const classes = useStyles()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const blocked = Model.Connectors.useIsBlocked(connectors)
  const inputDisabled = state._tag !== 'Idle' || blocked
  // `connectors.byId` is built once at service allocation and never
  // re-keyed, so this loop's length is stable per-mount and the
  // per-connector `Actor.useState` calls satisfy rules-of-hooks.
  const allConnectors = Object.values(connectors.byId)
  const connectorStates = allConnectors.map((c) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    Actor.useState(c.state),
  )
  const helperLines = allConnectors.flatMap((c, i) =>
    Model.Connectors.stateIsUnready(connectorStates[i])
      ? [
          <span key={c.id} className={classes.connectorLine}>
            <ConnectorHelperLine connector={c} state={connectorStates[i]} />
          </span>,
        ]
      : [],
  )
  const helperText = helperLines.length > 0 ? helperLines : undefined
  const helperSeverity = helperSeverityFor(connectorStates)

  const stateFingerprint = `${state._tag}:${state.timestamp.getTime()}`

  usePrevious(stateFingerprint, (prev) => {
    if (prev && stateFingerprint !== prev) {
      scrollRef.current?.scrollIntoView({
        block: 'end',
        behavior: 'smooth',
      })
    }
  })

  const ask = React.useCallback(
    (content: string) => {
      dispatch(Model.Conversation.Action.Ask({ content }))
    },
    [dispatch],
  )

  const [devToolsOpen, setDevToolsOpen] = React.useState(false)

  const toggleDevTools = React.useCallback(
    () => setDevToolsOpen((prev) => !prev),
    [setDevToolsOpen],
  )

  return (
    <div className={classes.chat}>
      <div className={classes.header}>
        <span className={classes.qicon}>
          <M.Icon className={classes.qiconGlyph}>auto_awesome</M.Icon>
        </span>
        <div>
          <div className={classes.title}>Qurator</div>
          <div className={classes.subtitle}>Claude on Bedrock, with your permissions</div>
        </div>
        <M.IconButton
          className={classes.close}
          onClick={onClose}
          size="small"
          aria-label="Close Qurator"
        >
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </div>
      <Menu
        state={state}
        dispatch={dispatch}
        onToggleDevTools={toggleDevTools}
        devToolsOpen={devToolsOpen}
        className={classes.menu}
      />
      <M.Slide direction="down" mountOnEnter unmountOnExit in={devToolsOpen}>
        <M.Paper square className={classes.devTools}>
          <DevTools state={state} {...devTools} connectors={connectors} />
        </M.Paper>
      </M.Slide>
      <div className={classes.historyContainer}>
        <div className={classes.history}>
          <MessageContainer>
            Hi! I'm Qurator, your AI assistant. Ask me about your packages, buckets and
            data — I can search, query and summarize them for you.
          </MessageContainer>
          {state.events
            .filter((e) => !e.discarded)
            .map(
              Model.Conversation.Event.$match({
                Message: (event) => (
                  <MessageEvent
                    key={event.id}
                    dispatch={dispatch}
                    state={state._tag}
                    {...event}
                  />
                ),
                ToolUse: (event) => (
                  <ToolUseEvent
                    key={event.id}
                    dispatch={dispatch}
                    state={state._tag}
                    {...event}
                  />
                ),
              }),
            )}
          {Model.Conversation.State.$match(state, {
            Idle: (s) =>
              Eff.Option.match(s.error, {
                onSome: (e) => (
                  <ErrorState
                    message={e.message}
                    details={e.details}
                    timestamp={s.timestamp}
                  />
                ),
                onNone: () => null,
              }),
            WaitingForAssistant: (s) => (
              <WaitingState dispatch={dispatch} timestamp={s.timestamp} />
            ),
            ToolUse: (s) => (
              <ToolUseState dispatch={dispatch} timestamp={s.timestamp} calls={s.calls} />
            ),
            AwaitingConnector: (s) => (
              <AwaitingConnectorState dispatch={dispatch} timestamp={s.timestamp} />
            ),
          })}
          <div ref={scrollRef} />
        </div>
      </div>
      <Instructions instructions={instructions} />
      <Input
        disabled={inputDisabled}
        helperText={helperText}
        helperSeverity={helperSeverity}
        onSubmit={ask}
      />
    </div>
  )
}
