import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import JsonDisplay from 'components/JsonDisplay'
import Markdown from 'components/Markdown'
import { useMCPContextStateValue } from 'components/Assistant/MCP/MCPContextProvider'
import usePrevious from 'utils/usePrevious'

import * as Model from '../../Model'
import { calculateCumulativeUsage } from '../../Utils/TokenCounter'
import ContextMeter from '../ContextMeter/ContextMeter'
import { JWTRefreshNotification, useJWTErrorDetection } from '../JWTRefreshNotification'

import Settings from '../Settings'
import DevTools from './DevTools'
import Input from './Input'
import ThinkingIndicator from './ThinkingIndicator'

const BG = {
  intense: M.colors.indigo[900],
  normal: M.colors.common.white,
  faint: M.colors.grey[600],
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
  contentArea: {
    borderRadius: `${t.spacing(1)}px`,
    '$color_intense &': {
      background: BG.intense,
      color: M.fade(t.palette.common.white, 0.8),
    },
    '$color_normal &': {
      background: BG.normal,
      color: t.palette.text.primary,
    },
    '$color_faint &': {
      background: BG.faint,
      color: t.palette.getContrastText(BG.faint),
      opacity: 0.5,
      '&:hover': {
        opacity: 1,
      },
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
    paddingTop: '6px',
  },
  actions: {
    opacity: 0.7,
    '$messageContainer:hover &': {
      opacity: 1,
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

const useMessageActionStyles = M.makeStyles({
  action: {
    cursor: 'pointer',
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
  },
})

const useToolMessageStyles = M.makeStyles((t) => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    '&:hover': {
      opacity: 0.8,
    },
  },
  icon: {
    fontSize: '1rem',
    color: 'inherit',
  },
  toolName: {
    marginLeft: t.spacing(1),
    marginRight: t.spacing(1),
  },
  spinner: {
    color: 'inherit',
  },
  details: {
    marginTop: t.spacing(1),
  },
}))

interface MessageActionProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

function MessageAction({ children, onClick }: MessageActionProps) {
  const classes = useMessageActionStyles()
  return (
    <span className={classes.action} onClick={onClick}>
      {children}
    </span>
  )
}

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
      <div className={classes.header} onClick={toggleExpanded}>
        <Icons.Build className={classes.icon} />
        <span className={classes.toolName}>{name}</span>
        {status === 'success' && <Icons.CheckCircleOutline className={classes.icon} />}
        {status === 'error' && <Icons.ErrorOutline className={classes.icon} />}
        {status === 'running' && (
          <M.CircularProgress size={14} thickness={4} className={classes.spinner} />
        )}
      </div>
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

function MessageEvent({
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

  return (
    <MessageContainer
      color={role === 'user' ? 'intense' : 'normal'}
      align={role === 'user' ? 'right' : 'left'}
      actions={discard && <MessageAction onClick={discard}>discard</MessageAction>}
      timestamp={timestamp}
    >
      {Model.Content.MessageContentBlock.$match(content, {
        Text: ({ text }) => <Markdown data={text} />,
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

function WaitingState({ timestamp, dispatch }: WaitingStateProps) {
  const abort = React.useCallback(
    () => dispatch(Model.Conversation.Action.Abort()),
    [dispatch],
  )
  return (
    <MessageContainer
      timestamp={timestamp}
      actions={<MessageAction onClick={abort}>abort</MessageAction>}
    >
      <ThinkingIndicator />
    </MessageContainer>
  )
}

interface MenuProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  onToggleDevTools: () => void
  onToggleSettings: () => void
  devToolsOpen: boolean
  settingsOpen: boolean
  className?: string
}

function Menu({
  state,
  dispatch,
  devToolsOpen,
  settingsOpen,
  onToggleDevTools,
  onToggleSettings,
  className,
}: MenuProps) {
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

  const showSettings = React.useCallback(() => {
    onToggleSettings()
    closeMenu()
  }, [closeMenu, onToggleSettings])

  const panelOpen = devToolsOpen || settingsOpen

  return (
    <>
      <M.Fade in={!panelOpen}>
        <M.IconButton
          aria-label="menu"
          aria-haspopup="true"
          onClick={toggleMenu}
          className={className}
        >
          <M.Icon>menu</M.Icon>
        </M.IconButton>
      </M.Fade>
      <M.Fade in={panelOpen}>
        <M.Tooltip title="Close">
          <M.IconButton
            aria-label="close"
            onClick={() => {
              if (devToolsOpen) onToggleDevTools()
              if (settingsOpen) onToggleSettings()
            }}
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
        <M.MenuItem onClick={showSettings}>Settings</M.MenuItem>
        <M.MenuItem onClick={showDevTools}>Developer Tools</M.MenuItem>
      </M.Menu>
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  chat: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
  menu: {
    position: 'absolute',
    right: t.spacing(1),
    top: t.spacing(1),
    zIndex: 1,
  },
  contextMeter: {
    position: 'absolute',
    right: t.spacing(2),
    bottom: t.spacing(10),
    zIndex: 1,
  },
  devTools: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  resizeHandle: {
    height: 4,
    background:
      'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.1) 50%, transparent 100%)',
    cursor: 'ns-resize',
    position: 'relative',
    zIndex: 2,
    transition: 'background 0.2s ease',
    '&:hover': {
      background:
        'linear-gradient(to bottom, transparent 0%, rgba(102, 126, 234, 0.4) 50%, transparent 100%)',
    },
    '&:active': {
      background:
        'linear-gradient(to bottom, transparent 0%, rgba(102, 126, 234, 0.6) 50%, transparent 100%)',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -4,
      left: 0,
      right: 0,
      height: 12,
    },
  },
  historyContainer: {
    flexGrow: 1,
    overflowY: 'auto',
    minHeight: 0, // Important for flex child to shrink
    // TODO: nice overflow markers
    // position: 'relative',
    // '&::before': {
    //   content: '""',
    //   position: 'absolute',
    // },
    // '&::after': {
    // },
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
  input: {
    flexShrink: 0, // Prevent input from shrinking
    minHeight: 120, // Ensure minimum height for input area
  },
}))

interface ChatProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  devTools: Model.Assistant.API['devTools']
}

export default function Chat({ state, dispatch, devTools }: ChatProps) {
  const classes = useStyles()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const mcpState = useMCPContextStateValue()

  // Resizable panel state
  const [settingsHeight, setSettingsHeight] = React.useState(70) // Percentage
  const [isResizing, setIsResizing] = React.useState(false)
  const chatContainerRef = React.useRef<HTMLDivElement>(null)

  // JWT error detection
  const {
    showNotification: showJWTNotification,
    dismissNotification: dismissJWTNotification,
    resetErrors: resetJWTErrors,
  } = useJWTErrorDetection()

  // Calculate cumulative token usage
  const contextUsage = React.useMemo(() => {
    const tokenUsageHistory = state.tokenUsage || []
    if (tokenUsageHistory.length === 0) return null

    // Use the model ID from devTools if available, otherwise use default
    const modelId = devTools.modelIdOverride.value || Model.Assistant.DEFAULT_MODEL_ID
    return calculateCumulativeUsage(tokenUsageHistory, modelId)
  }, [state.tokenUsage, devTools.modelIdOverride.value])

  // Get available buckets for @ mentions
  const [availableBuckets, setAvailableBuckets] = React.useState<string[]>([])

  React.useEffect(() => {
    const fetchBuckets = async () => {
      try {
        // Try multiple sources for bucket discovery
        let buckets: string[] = []

        // 1. Try the auth manager first
        const authManager = (window as any).__dynamicAuthManager // eslint-disable-line no-underscore-dangle
        if (authManager && typeof authManager.getCurrentBuckets === 'function') {
          buckets = await authManager.getCurrentBuckets()
        }

        // 2. Fallback to AWS bucket discovery service
        if (!buckets || buckets.length === 0) {
          const bucketService = (window as any).__awsBucketDiscoveryService // eslint-disable-line no-underscore-dangle
          if (bucketService && typeof bucketService.getAvailableBuckets === 'function') {
            buckets = await bucketService.getAvailableBuckets()
          }
        }

        // 3. Fallback to hardcoded common buckets
        if (!buckets || buckets.length === 0) {
          buckets = [
            'quilt-sandbox-bucket',
            'quilt-sales-raw',
            'quilt-sales-staging',
            'cellpainting-gallery',
            'data-drop-off-bucket',
            'example-pharma-data',
            'nf-core-gallery',
            'pmc-oa-opendata',
            'quilt-benchling',
            'quilt-cro',
          ]
        }

        setAvailableBuckets(buckets || [])
      } catch (error) {
        // Failed to fetch buckets for @ mentions
        // Set fallback buckets on error
        setAvailableBuckets([
          'quilt-sandbox-bucket',
          'cellpainting-gallery',
          'example-pharma-data',
        ])
      }
    }

    fetchBuckets()
  }, [])

  // Resize handler
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!chatContainerRef.current) return

      const containerRect = chatContainerRef.current.getBoundingClientRect()
      const mouseY = e.clientY - containerRect.top
      const newHeight = (mouseY / containerRect.height) * 100

      // Clamp between 30% and 90%
      const clampedHeight = Math.max(30, Math.min(90, newHeight))
      setSettingsHeight(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const mcpStatusBanner = React.useMemo(() => {
    switch (mcpState.status) {
      case 'loading':
        return {
          text: 'Connecting to the Model Context Protocol toolchain…',
          bg: M.colors.blue[50],
          color: M.colors.blue[900],
        }
      case 'ready': {
        const toolNames = Object.keys(mcpState.tools)
        const preview = toolNames.slice(0, 4).join(', ')
        const remainder = toolNames.length > 4 ? `, +${toolNames.length - 4} more` : ''
        return {
          text: `MCP toolchain connected — ${toolNames.length} available tool${
            toolNames.length === 1 ? '' : 's'
          }.`,
          detail: toolNames.length ? `${preview}${remainder}` : undefined,
          bg: M.colors.green[50],
          color: M.colors.green[900],
        }
      }
      case 'error':
        return {
          text: `MCP toolchain unavailable: ${mcpState.error ?? 'unknown error'}`,
          bg: M.colors.red[50],
          color: M.colors.red[900],
        }
      default:
        return null
    }
  }, [mcpState])

  const inputDisabled = state._tag !== 'Idle'

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
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const toggleDevTools = React.useCallback(() => {
    setDevToolsOpen((prev) => !prev)
    setSettingsOpen(false)
  }, [setDevToolsOpen, setSettingsOpen])

  const toggleSettings = React.useCallback(() => {
    setSettingsOpen((prev) => !prev)
    setDevToolsOpen(false)
  }, [setSettingsOpen, setDevToolsOpen])

  return (
    <div className={classes.chat} ref={chatContainerRef}>
      {contextUsage && (
        <ContextMeter usage={contextUsage} className={classes.contextMeter} />
      )}
      <Menu
        state={state}
        dispatch={dispatch}
        onToggleDevTools={toggleDevTools}
        onToggleSettings={toggleSettings}
        devToolsOpen={devToolsOpen}
        settingsOpen={settingsOpen}
        className={classes.menu}
      />
      <M.Slide direction="down" mountOnEnter unmountOnExit in={settingsOpen}>
        <M.Paper
          square
          className={classes.devTools}
          style={{ height: `${settingsHeight}%` }}
        >
          <Settings modelIdOverride={devTools.modelIdOverride} />
          <div
            className={classes.resizeHandle}
            onMouseDown={handleResizeStart}
            style={{
              cursor: isResizing ? 'ns-resize' : undefined,
              userSelect: isResizing ? 'none' : undefined,
            }}
          />
        </M.Paper>
      </M.Slide>
      <M.Slide direction="down" mountOnEnter unmountOnExit in={devToolsOpen}>
        <M.Paper
          square
          className={classes.devTools}
          style={{ height: `${settingsHeight}%` }}
        >
          <DevTools state={state} {...devTools} />
          <div
            className={classes.resizeHandle}
            onMouseDown={handleResizeStart}
            style={{
              cursor: isResizing ? 'ns-resize' : undefined,
              userSelect: isResizing ? 'none' : undefined,
            }}
          />
        </M.Paper>
      </M.Slide>
      <div className={classes.historyContainer}>
        <div className={classes.history}>
          {mcpStatusBanner && (
            <M.Box
              borderRadius={12}
              padding={2}
              style={{
                backgroundColor: mcpStatusBanner.bg,
                color: mcpStatusBanner.color,
              }}
            >
              <M.Typography variant="body2" style={{ color: mcpStatusBanner.color }}>
                {mcpStatusBanner.text}
              </M.Typography>
              {mcpStatusBanner.detail && (
                <M.Typography variant="caption" style={{ color: mcpStatusBanner.color }}>
                  {mcpStatusBanner.detail}
                </M.Typography>
              )}
            </M.Box>
          )}
          {showJWTNotification && (
            <JWTRefreshNotification
              onRefresh={resetJWTErrors}
              onDismiss={dismissJWTNotification}
            />
          )}
          <MessageContainer>
            Hi! I'm Qurator, your AI assistant. How can I help you?
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
                  <MessageContainer timestamp={s.timestamp}>
                    <b>{e.message}</b>
                    <br />
                    {e.details}
                  </MessageContainer>
                  // TODO: retry / discard
                ),
                onNone: () => null,
              }),
            WaitingForAssistant: (s) => (
              <WaitingState dispatch={dispatch} timestamp={s.timestamp} />
            ),
            ToolUse: (s) => (
              <ToolUseState dispatch={dispatch} timestamp={s.timestamp} calls={s.calls} />
            ),
          })}
          <div ref={scrollRef} />
        </div>
      </div>
      <Input
        className={classes.input}
        disabled={inputDisabled}
        onSubmit={ask}
        buckets={availableBuckets}
        chatHistory={state.events
          .filter((event) => event._tag === 'Message')
          .map((event) => {
            const messageEvent = event as Extract<typeof event, { _tag: 'Message' }>
            return {
              role: messageEvent.role,
              content:
                typeof messageEvent.content === 'string'
                  ? messageEvent.content
                  : JSON.stringify(messageEvent.content),
              timestamp: messageEvent.timestamp,
            }
          })}
        onCopyHistory={() => {
          // Chat history copied
        }}
      />
    </div>
  )
}
