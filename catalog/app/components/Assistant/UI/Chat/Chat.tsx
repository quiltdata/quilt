import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import { Link, useRouteMatch } from 'react-router-dom'
import * as uuid from 'uuid'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import Markdown from 'components/Markdown'
import * as Actor from 'utils/Actor'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'
import { runtime } from 'utils/Effect'
import usePrevious from 'utils/usePrevious'

import * as Model from '../../Model'

import DevTools from './DevTools'
import Input from './Input'
import Composer from '../Composer/Composer'
import type { SessionSave } from '../../Model/SessionSave'
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
  reason: {
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    color: t.palette.text.secondary,
    display: '-webkit-box',
    overflow: 'hidden',
  },
}))

interface ConversationDispatchProps {
  dispatch: Model.Assistant.API['dispatch']
}

interface ConversationStateProps {
  state: Model.Conversation.State['_tag']
}

/** `platform__package_patch` → `package patch` */
export const toolTitle = Model.Tool.title

interface ToolMessageProps {
  name: string
  status?: 'success' | 'error' | 'running'
  reason?: string
  details: Record<string, any>
  timestamp: Date
  actions?: React.ReactNode
  // Controlled by the caller when it must survive this component
  // unmounting (e.g. ToolCallRollup's single-call branch, so a toggle set
  // before a second call lands isn't lost when that branch stops rendering
  // this component at all). Defaults to an internal, uncontrolled toggle.
  expanded?: boolean
  onToggleExpanded?: () => void
}

function ToolMessage({
  name,
  status,
  reason,
  details,
  timestamp,
  actions,
  expanded: expandedProp,
  onToggleExpanded,
}: ToolMessageProps) {
  const classes = useToolMessageStyles()
  const [expandedState, setExpandedState] = React.useState(false)
  const expanded = expandedProp ?? expandedState
  const toggleExpanded = onToggleExpanded ?? (() => setExpandedState((prev) => !prev))

  return (
    <MessageContainer color="faint" timestamp={timestamp} actions={actions}>
      <M.ButtonBase
        className={classes.header}
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <M.Icon className={classes.icon}>bolt</M.Icon>
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
      {reason && !expanded && <div className={classes.reason}>{reason}</div>}
      <M.Collapse in={expanded}>
        <div className={classes.details}>
          <JsonDisplay defaultExpanded={2} name="details" value={details} />
        </div>
      </M.Collapse>
    </MessageContainer>
  )
}

// One call, resolved for display regardless of whether it's a completed
// history event or still running in `State.ToolUse`: this is the unit a
// rollup lists once expanded.
interface ToolCallEntry {
  readonly key: string
  readonly name: string
  readonly status: 'success' | 'error' | 'running'
  readonly reason?: string
  readonly timestamp: Date
  readonly details: Record<string, any>
  readonly discard?: () => void
}

const useRollupStyles = M.makeStyles((t) => ({
  summary: {
    color: 'inherit',
  },
  count: {
    color: t.palette.text.hint,
  },
  entries: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
    marginTop: t.spacing(1),
  },
  entryHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  entryName: {
    flexGrow: 1,
  },
  entryDetails: {
    marginTop: t.spacing(0.5),
  },
}))

interface ToolCallRollupProps {
  calls: readonly ToolCallEntry[]
  timestamp: Date
  actions?: React.ReactNode
  // Controlled by ToolCallGroup, which owns this across the single-call
  // (ToolMessage) and multi-call (this component's own markup) branches
  // below -- those are different subtrees, so internal state here would
  // reset whenever a group crosses the 1/2+ call boundary.
  expanded: boolean
  onToggleExpanded: () => void
}

// A run of tool calls (one response can trigger many) as one row instead of
// a stacked card per call: a summary that names whichever call is still
// running — or, once everything has settled, how many ran and whether any
// failed — with the familiar per-call detail view available behind a toggle
// so no error or payload is lost, just deferred.
function ToolCallRollup({
  calls,
  timestamp,
  actions,
  expanded,
  onToggleExpanded: toggleExpanded,
}: ToolCallRollupProps) {
  const classes = useToolMessageStyles()
  const rollupClasses = useRollupStyles()

  const running = calls.filter((c) => c.status === 'running')
  const failed = calls.filter((c) => c.status === 'error')

  // Single call: the per-call row already carries everything a rollup would
  // summarize, so skip the extra wrapper and render it directly.
  if (calls.length === 1) {
    const [call] = calls
    return (
      <ToolMessage
        name={call.name}
        status={call.status}
        reason={call.reason}
        details={call.details}
        timestamp={call.timestamp}
        actions={
          actions ??
          (call.discard && <MessageAction onClick={call.discard}>discard</MessageAction>)
        }
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
      />
    )
  }

  const summary = running.length
    ? `Running: ${running.map((c) => c.name).join(', ')}`
    : `${calls.length} tool calls${failed.length ? `, ${failed.length} failed` : ''}`

  return (
    <MessageContainer color="faint" timestamp={timestamp} actions={actions}>
      <M.ButtonBase
        className={classes.header}
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <M.Icon className={classes.icon}>bolt</M.Icon>
        <span className={cx(classes.toolName, rollupClasses.summary)}>{summary}</span>
        <span className={rollupClasses.count}>
          {running.length ? `${calls.length - running.length}/${calls.length}` : null}
        </span>
        {!running.length && !failed.length && (
          <M.Icon className={cx(classes.icon, classes.success)} aria-label="Succeeded">
            check_circle_outline
          </M.Icon>
        )}
        {!running.length && !!failed.length && (
          <M.Icon className={cx(classes.icon, classes.error)} aria-label="Failed">
            error_outline
          </M.Icon>
        )}
        {!!running.length && (
          <M.CircularProgress
            size={14}
            thickness={4}
            className={classes.running}
            aria-label="Running"
          />
        )}
      </M.ButtonBase>
      <M.Collapse in={expanded}>
        <div className={rollupClasses.entries}>
          {calls.map((call) => (
            <div key={call.key}>
              <div className={rollupClasses.entryHeader}>
                <M.Icon className={classes.icon}>bolt</M.Icon>
                <span className={rollupClasses.entryName}>{call.name}</span>
                {call.status === 'success' && (
                  <M.Icon
                    className={cx(classes.icon, classes.success)}
                    aria-label="Succeeded"
                  >
                    check_circle_outline
                  </M.Icon>
                )}
                {call.status === 'error' && (
                  <M.Icon className={cx(classes.icon, classes.error)} aria-label="Failed">
                    error_outline
                  </M.Icon>
                )}
                {call.status === 'running' && (
                  <M.CircularProgress
                    size={14}
                    thickness={4}
                    className={classes.running}
                    aria-label="Running"
                  />
                )}
                {call.discard && (
                  <MessageAction onClick={call.discard}>discard</MessageAction>
                )}
              </div>
              {call.reason && <div className={classes.reason}>{call.reason}</div>}
              <div className={rollupClasses.entryDetails}>
                <JsonDisplay defaultExpanded={1} name="details" value={call.details} />
              </div>
            </div>
          ))}
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

// A maximal run of consecutive history `ToolUse` events, plus the live
// `State.ToolUse` calls when the run is still in progress: one rollup, one
// discard per finished call, one abort for whatever's still running.
interface ToolCallGroupProps extends ConversationDispatchProps, ConversationStateProps {
  events: ReturnType<typeof Model.Conversation.Event.ToolUse>[]
  live?: { timestamp: Date; calls: Model.Conversation.ToolCalls }
  // Controlled by Chat, which outlives every ToolCallGroup remount a round
  // goes through (standalone live-only -> merged into history -> settled):
  // defaults to an internal, uncontrolled toggle for callers that render a
  // group in isolation (e.g. tests) and don't need it to survive a remount.
  expanded?: boolean
  onToggleExpanded?: () => void
}

export function ToolCallGroup({
  state,
  events,
  live,
  dispatch,
  expanded: expandedProp,
  onToggleExpanded: onToggleExpandedProp,
}: ToolCallGroupProps) {
  const [expandedState, setExpandedState] = React.useState(false)
  const expanded = expandedProp ?? expandedState
  const toggleExpanded = onToggleExpandedProp ?? (() => setExpandedState((prev) => !prev))

  const discard = React.useCallback(
    (id: string) => dispatch(Model.Conversation.Action.Discard({ id })),
    [dispatch],
  )
  const abort = React.useCallback(
    () => dispatch(Model.Conversation.Action.Abort()),
    [dispatch],
  )

  // A call awaiting approval isn't running yet, so it never joins the
  // rollup: it needs the user's direct attention, not a collapsed summary
  // line, and stays its own ApprovalCard until approved or denied.
  const liveRunning = React.useMemo(
    () => (live ? Eff.Record.filter(live.calls, (c) => !c.approval) : {}),
    [live],
  )

  const calls: ToolCallEntry[] = React.useMemo(() => {
    // Deduped by (responseId, toolUseId), not bare toolUseId: a toolUseId
    // is only guaranteed unique within its own response's batch
    // (Model/Conversation.ts's own uniqueness check is scoped to that one
    // batch), so two unrelated calls from different, consecutive
    // tool-only responses (toolCallRunsOf merges them into one run, since
    // there's no Message between tool-only replies to break it) can
    // legitimately share a toolUseId -- keying on it alone would let the
    // later call's result silently overwrite the earlier one's, including
    // a failure. Namespacing by responseId also still keeps the dedup's
    // original purpose intact: a genuine retry (same response, same
    // toolUseId, a second ToolUse event) still collapses to one entry, so
    // the rollup's failure count stays correct if that case ever appears.
    const byCallKey = new Map<string, ToolCallEntry>()
    for (const e of events) {
      const reason =
        e.result.status === 'error'
          ? e.result.content.find((c) => c._tag === 'Text')
          : undefined
      const callKey = `${e.responseId}\u0000${e.toolUseId}`
      byCallKey.set(callKey, {
        key: callKey,
        name: toolTitle(e.name),
        status: e.result.status,
        reason: reason?._tag === 'Text' ? reason.text : undefined,
        timestamp: e.timestamp,
        details: { toolUseId: e.toolUseId, input: e.input, result: e.result },
        discard: state === 'Idle' ? () => discard(e.id) : undefined,
      })
    }
    const finished = Array.from(byCallKey.values())

    const running: ToolCallEntry[] = Eff.Record.collect(
      liveRunning,
      (toolUseId, call) => ({
        key: toolUseId,
        name: toolTitle(call.name),
        status: 'running' as const,
        timestamp: live!.timestamp,
        details: { name: call.name, input: call.input },
      }),
    )

    return finished.concat(running)
  }, [events, live, liveRunning, state, discard])

  const timestamp = live?.timestamp ?? events[events.length - 1]?.timestamp ?? new Date()
  const abortAction = <MessageAction onClick={abort}>abort</MessageAction>

  return (
    <>
      {live &&
        Eff.Record.collect(live.calls, (id, call) =>
          call.approval ? (
            <ApprovalCard
              key={id}
              id={id}
              call={call}
              approval={call.approval}
              dispatch={dispatch}
              timestamp={live.timestamp}
              actions={Object.keys(liveRunning).length ? undefined : abortAction}
            />
          ) : null,
        )}
      {calls.length > 0 && (
        <ToolCallRollup
          calls={calls}
          timestamp={timestamp}
          actions={Object.keys(liveRunning).length ? abortAction : undefined}
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
        />
      )}
    </>
  )
}

const useApprovalStyles = M.makeStyles((t) => ({
  heading: {
    alignItems: 'center',
    display: 'flex',
    fontWeight: t.typography.fontWeightMedium,
    gap: t.spacing(0.5),
  },
  destructive: {
    color: t.palette.error.dark,
  },
  icon: {
    fontSize: t.typography.body1.fontSize,
  },
  args: {
    color: t.palette.text.secondary,
    listStyle: 'none',
    margin: t.spacing(0.5, 0),
    overflowWrap: 'anywhere',
    padding: 0,
    // An inline file body must not push Run / Don't run off-screen; the full
    // input is in the expander below.
    '& li': {
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: 3,
      display: '-webkit-box',
      overflow: 'hidden',
    },
  },
  buttons: {
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(1),
  },
}))

const isScalar = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

interface ApprovalCardProps extends ConversationDispatchProps {
  id: string
  call: Model.Conversation.ToolCall
  approval: NonNullable<Model.Conversation.ToolCall['approval']>
  timestamp: Date
  actions?: React.ReactNode
}

// A write waits here until the user says so: content Qurator has read can
// steer the model, so the user's role permitting a write is not consent.
function ApprovalCard({
  id,
  call,
  approval,
  dispatch,
  timestamp,
  actions,
}: ApprovalCardProps) {
  const classes = useApprovalStyles()
  const approve = React.useCallback(
    () => dispatch(Model.Conversation.Action.Approve({ id, key: call.key ?? '' })),
    [dispatch, id, call.key],
  )
  const deny = React.useCallback(
    () => dispatch(Model.Conversation.Action.Deny({ id, key: call.key ?? '' })),
    [dispatch, id, call.key],
  )
  const destructive = approval === 'destructive'
  // A model can send no input at all; the card must still render.
  const input = call.input ?? {}
  const args = Object.entries(input).filter(([, v]) => isScalar(v))
  return (
    <MessageContainer timestamp={timestamp} actions={actions}>
      <div className={cx(classes.heading, destructive && classes.destructive)}>
        <M.Icon className={classes.icon}>{destructive ? 'warning' : 'edit'}</M.Icon>
        Qurator wants to run “{toolTitle(call.name)}”
      </div>
      {destructive && <div>This can replace or delete existing data.</div>}
      {args.length > 0 && (
        <ul className={classes.args}>
          {args.map(([k, v]) => (
            <li key={k}>
              {k}: {String(v)}
            </li>
          ))}
        </ul>
      )}
      <JsonDisplay
        defaultExpanded={args.length < Object.keys(input).length ? 2 : 0}
        name="input"
        value={input}
      />
      <div className={classes.buttons}>
        <M.Button size="small" variant="contained" color="primary" onClick={approve}>
          Run
        </M.Button>
        <M.Button size="small" variant="outlined" onClick={deny}>
          Don't run
        </M.Button>
      </div>
    </MessageContainer>
  )
}

interface WaitingStateProps extends ConversationDispatchProps {
  timestamp: Date
  busy?: boolean
}

const useWaitingStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(1),
  },
  spinner: {
    color: 'inherit',
    flexShrink: 0,
    marginTop: 3,
  },
}))

function WaitingState({ timestamp, dispatch, busy = false }: WaitingStateProps) {
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
      <span className={classes.root} role="status">
        <M.CircularProgress
          size={14}
          thickness={4}
          className={classes.spinner}
          aria-hidden
        />
        {busy
          ? 'Qurator is busy with other requests, so this may take a little longer…'
          : 'Thinking…'}
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

export function Menu({
  state,
  dispatch,
  devToolsOpen,
  onToggleDevTools,
  className,
}: MenuProps) {
  const [menuOpen, setMenuOpen] = React.useState<HTMLElement | null>(null)
  const { paths, urls } = NamedRoutes.use()
  const fullPage = !!useRouteMatch({
    path: [paths.qurator, paths.quratorMode],
    exact: true,
  })

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
      <M.IconButton
        aria-label="Qurator menu"
        aria-haspopup="true"
        aria-expanded={!!menuOpen}
        onClick={toggleMenu}
        className={className}
        size="small"
      >
        <M.Icon>menu</M.Icon>
      </M.IconButton>
      <M.Menu
        anchorEl={menuOpen}
        open={!!menuOpen}
        onClose={closeMenu}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <M.MenuItem onClick={startNewSession} disabled={!isIdle}>
          New session
        </M.MenuItem>
        {!fullPage && (
          // The conversation lives in the app-wide provider, so it carries over.
          <M.MenuItem component={Link} to={urls.qurator()} onClick={closeMenu}>
            Open full page
          </M.MenuItem>
        )}
        <M.MenuItem onClick={showDevTools}>
          {devToolsOpen ? 'Hide Developer Tools' : 'Developer Tools'}
        </M.MenuItem>
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
    padding: t.spacing(1, 1, 1, 2),
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
  // Menu and close share one size, color and focus ring, centered on the row.
  headerButton: {
    color: t.palette.text.secondary,
    // The Focus Ring Rule (DESIGN.md §2), light half: midnight on white.
    '&&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  trailing: {
    marginLeft: 'auto',
  },
  devTools: {
    height: '50%',
    position: 'relative',
  },
  starters: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${t.spacing(1.5)}px`,
    margin: '0 auto',
    maxWidth: 640,
    width: '100%',
  },
  starterGrid: {
    display: 'grid',
    gap: `${t.spacing(1)}px`,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  starter: {
    ...t.typography.body2,
    alignItems: 'flex-start',
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius * 2,
    display: 'flex',
    gap: `${t.spacing(1.25)}px`,
    justifyContent: 'flex-start',
    minHeight: 44,
    padding: t.spacing(1.25, 1.5),
    textAlign: 'left',
    '&:hover': { borderColor: t.palette.text.disabled },
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 1,
    },
  },
  starterIcon: { color: t.palette.text.secondary, fontSize: 18, marginTop: 1 },
  starterHint: {
    ...t.typography.caption,
    background: M.fade(t.palette.warning.main, 0.1),
    borderRadius: 10,
    color: t.palette.warning.dark,
    marginLeft: t.spacing(0.75),
    padding: t.spacing(0, 0.75),
    whiteSpace: 'nowrap',
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

// A round's permanent key is decided the moment it's first observed and
// never changes again. A round first seen already settled uses its own
// `anchor` (its first event's id, from `toolCallGroupIdsOf`) directly, with
// no lookup needed -- a permanent, conversation-wide-unique identity on its
// own, since `genId`/`uuid.v4()` mints it fresh per completed call, so no
// two rounds can ever share one. A round first seen still live has no
// anchor yet, so it's minted its own key up front and that pairing is
// recorded in `anchorKeys` (see `advanceAnchorKeys` below) the moment its
// anchor appears, so every later render -- however many *other* rounds
// have since come and gone -- keeps resolving this one anchor to its own
// pre-anchor key. `anchorKeys` is never derived from a toolUseId, so a
// toolUseId reused across rounds (the model only guarantees uniqueness
// within one response -- Model/Conversation.ts:353-357) can't collide here
// or anywhere in this scheme.
export function roundKeyOf(
  anchorKeys: ReadonlyMap<string, string>,
  pendingLive: PendingLive | undefined,
  group: ToolCallGroupIds,
): string | undefined {
  if (group.anchor === undefined) return pendingLive?.key
  return anchorKeys.get(group.anchor) ?? group.anchor
}

/**
 * The one round that's still live and has no anchor yet. `responseId` is
 * the one fact that survives into the render where it settles (`anchor`
 * doesn't exist until then) and safely identifies its own round's
 * trailing group once it appears -- unlike its `toolUseId`s, which the
 * model only guarantees unique within their own response and so can
 * collide with an unrelated round's.
 */
export interface PendingLive {
  readonly key: string
  readonly responseId: string
}

// `toolCallGroupIdsOf` never produces more than one anchorless group per
// call (only the trailing run can be anchorless, and there's at most one
// trailing run), so one slot holds it. `mintKey` is injected (rather than
// calling `uuid.v4()` here directly) so a test can supply a predictable key
// instead of asserting against a random one.
//
// `anchorKeys` grows by exactly one entry per round that was ever live and
// has since settled -- recorded once, the render its anchor first appears,
// and never touched again after that (an anchor is permanent and globally
// unique on its own, so there is nothing to update or garbage-collect).
// Earlier designs tried to track only the single *currently relevant*
// pairing in one slot and recompute whether it still applied each render;
// that single slot can hold at most one round's claim, so a second round
// settling, or the live round simply vanishing (an abort before any call
// resolves leaves `events` unchanged -- Conversation.ts's Abort handler
// returns State.Idle with no new ToolUse event -- so there's no settling
// event to attach the claim to, and the next render's trailing group is
// just whatever older round happened to be there), both evicted or
// misdirected an unrelated round's claim. A full map has no such ceiling:
// every round that ever settles keeps its own entry, forever, independent
// of how many other rounds come after it.
//
// An earlier version of this discriminated "did this round just settle"
// by checking for shared `toolUseId`s between the pending round and the
// new trailing group -- but a toolUseId is only guaranteed unique within
// its own response (Model/Conversation.ts:353-357), so a *different*,
// Message-separated round reusing one could still pass that check and
// steal its key. `responseId` (now carried on every ToolCall/ToolUse
// event, minted fresh per LLMResponse batch) is the real, collision-safe
// identity to check instead.
export function advanceAnchorKeys(
  anchorKeys: ReadonlyMap<string, string>,
  pendingLive: PendingLive | undefined,
  toolCallGroupIds: readonly ToolCallGroupIds[],
  mintKey: () => string,
): { anchorKeys: ReadonlyMap<string, string>; pendingLive: PendingLive | undefined } {
  const liveGroup = toolCallGroupIds.find((g) => g.anchor === undefined)
  if (liveGroup) {
    // Still anchorless: keep minting nothing further once a key already
    // exists for it.
    return {
      anchorKeys,
      pendingLive: {
        key: pendingLive?.key ?? mintKey(),
        responseId: liveGroup.responseId,
      },
    }
  }
  if (!pendingLive) return { anchorKeys, pendingLive: undefined }
  // The round that was pending has no anchorless group anymore: either it
  // just settled (its first call resolved into the new trailing group,
  // which carries this exact responseId -- `toolCallRunsOf` now only ever
  // merges events sharing one, and the live tail always comes from the
  // single response in flight), or it was aborted away with no event at
  // all (no new group carries this responseId anywhere -- the trailing
  // group, if any, is an unrelated older round with a different one).
  const [trailingGroup] = toolCallGroupIds.slice(-1)
  const settledHere =
    trailingGroup?.anchor !== undefined &&
    trailingGroup.responseId === pendingLive.responseId
  if (settledHere) {
    const next = new Map(anchorKeys)
    next.set(trailingGroup.anchor, pendingLive.key)
    return { anchorKeys: next, pendingLive: undefined }
  }
  return { anchorKeys, pendingLive: undefined }
}

// Consecutive ToolUse events roll up into one group; a Message in between
// breaks the run (and never merges with another Message), since a rollup
// only reads as "this answer's tool calls" while nothing else has happened
// since. Grouping runs on the *unfiltered* event stream and discards are
// dropped from each run afterward -- filtering first would erase a
// discarded Message's run boundary and wrongly merge the ToolUse runs on
// either side of it into one.
// Two adjacent ToolUse events merge into one run only when they also share
// a responseId: two consecutive tool-only replies (no Message between
// them, since neither had text) are otherwise indistinguishable from one
// multi-call turn by tag alone, so without this a later response's calls
// would visually merge into an earlier, unrelated one's rollup -- not just
// risk losing a result to it (ToolCallGroup's own dedup is namespaced by
// responseId for that), but display two different turns as if they were
// one.
export function toolCallRunsOf(
  events: Model.Conversation.Event[],
): Model.Conversation.Event[][] {
  if (!Eff.Array.isNonEmptyArray(events)) return []
  return Eff.Array.groupWith(
    events,
    (a, b) =>
      a._tag === 'ToolUse' && b._tag === 'ToolUse' && a.responseId === b.responseId,
  )
    .map((run) => run.filter((e) => !e.discarded))
    .filter((run) => run.length > 0)
}

/**
 * One rollup's identity: `anchor` disambiguates it from every other rollup
 * that happens to share a `toolUseId` (the model only guarantees a
 * `toolUseId` is unique within its own response, not across the
 * conversation -- Model/Conversation.ts:353-357), and `ids` are the
 * `toolUseId`s it's currently known by. `responseId` is the one response
 * every event (and live call) in this group was created by -- a single
 * value, not one per id, since `toolCallRunsOf` now only ever merges
 * events that already share one, and the live tail always comes from the
 * single currently in-flight response. The anchor is the run's first
 * settled event's own event id (minted fresh per completed call, so it
 * can't collide with another run's), or `undefined` for a round that's
 * still entirely live and has no settled event yet -- there can be only
 * one such round at a time, so no anchor is needed until it has one.
 */
export interface ToolCallGroupIds {
  readonly anchor: string | undefined
  readonly responseId: string
  readonly ids: readonly string[]
}

// `isTrailing` is computed from each run's position in the *unfiltered*
// array before the Message runs are filtered out -- comparing a filtered
// array's own index against the unfiltered array's length would mismatch
// whenever a Message run comes before the trailing ToolUse run (e.g.
// [Message, ToolUse]), silently dropping live ids from the trailing group.
export function toolCallGroupIdsOf(
  toolCallRuns: readonly Model.Conversation.Event[][],
  liveToolUse: { calls: Model.Conversation.ToolCalls } | undefined,
): readonly ToolCallGroupIds[] {
  const toolUseRunIds = toolCallRuns
    .map((run, i) => ({ run, isTrailing: i === toolCallRuns.length - 1 }))
    .filter(({ run }) => run[0]._tag !== 'Message')
    .map(({ run, isTrailing }) => {
      const toolUseEvents = run as ReturnType<typeof Model.Conversation.Event.ToolUse>[]
      const toolUseIds = toolUseEvents.map((e) => e.toolUseId)
      const liveIds = isTrailing && liveToolUse ? Object.keys(liveToolUse.calls) : []
      const group: ToolCallGroupIds = {
        anchor: toolUseEvents[0].id,
        responseId: toolUseEvents[0].responseId,
        ids: toolUseIds.concat(liveIds),
      }
      return group
    })
  const liveCalls =
    liveToolUse && toolCallRuns[toolCallRuns.length - 1]?.[0]._tag !== 'ToolUse'
      ? Object.values(liveToolUse.calls)
      : []
  // Every call in one `live.calls` record comes from the single response
  // currently in flight (Conversation.ts never has two concurrently), so
  // any one of them names the whole group's responseId.
  const standaloneLiveIds: ToolCallGroupIds[] = liveCalls.length
    ? [
        {
          anchor: undefined,
          responseId: liveCalls[0].responseId,
          ids: Object.keys(liveToolUse!.calls),
        },
      ]
    : []
  return toolUseRunIds.concat(standaloneLiveIds)
}

interface ChatProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  devTools: Model.Assistant.API['devTools']
  connectors: Model.Assistant.API['connectors']
  instructions: Model.Assistant.API['instructions']
  model: Model.Assistant.API['model']
  skills: Model.Assistant.API['skills']
  mode?: Model.Assistant.API['mode']
  setMode?: Model.Assistant.API['setMode']
  busy?: boolean
  onClose: () => void
  /** `compact`: the + menu composer (Qurator mode, /qurator); `classic`: the docked panel's input. */
  composer?: 'classic' | 'compact'
  /** Save target for the + menu's Save row; the row is hidden without it. */
  save?: SessionSave
}

interface Starter {
  icon: string
  text: string
  hint?: string
}

const STARTERS: Starter[] = [
  { icon: 'search', text: 'Search my buckets for CSV files from this month' },
  {
    icon: 'hub',
    text: "Using DeepWiki, what does the quiltdata/quilt repo's catalog do?",
  },
  { icon: 'swap_horiz', text: 'Summarize the most recently updated package' },
  {
    icon: 'edit_note',
    text: 'Create a package qurator-demo/hello with a README that says hello',
    hint: 'asks first',
  },
]

export default function Chat({
  state,
  dispatch,
  devTools,
  connectors,
  instructions,
  model,
  skills,
  mode = 'agent',
  setMode,
  busy,
  onClose,
  composer = 'classic',
  save,
}: ChatProps) {
  const classes = useStyles()
  const [draft, setDraft] = React.useState<{ text: string; at: number }>()
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
  // Without this the fallback is silent: the switch and the override both vanish.
  if (model.readFailed) {
    helperLines.push(
      <span key="model-fallback" className={classes.connectorLine}>
        The approved model list couldn't be read, so Qurator is using this stack's default
        model.
      </span>,
    )
  }
  const helperText = helperLines.length > 0 ? helperLines : undefined
  const helperSeverity =
    helperSeverityFor(connectorStates) ?? (model.readFailed ? 'warning' : undefined)

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

  const toolCallRuns = toolCallRunsOf(state.events)
  const liveToolUse = Model.Conversation.State.$match(state, {
    Idle: () => undefined,
    WaitingForAssistant: () => undefined,
    ToolUse: (s) => ({ timestamp: s.timestamp, calls: s.calls }),
    AwaitingConnector: () => undefined,
  })

  // Every ToolCallGroup this render will show, by the ids it's currently
  // known by -- computed up front so each round's registration (below) can
  // run on every render that observes it, not only when it's toggled.
  // Without that, a call joining the round between toggles is never
  // assigned a key, and a later discard of the originally-keyed call would
  // leave it keyed under itself with no path back to the real entry.
  const toolCallGroupIds = toolCallGroupIdsOf(toolCallRuns, liveToolUse)

  // One round's tool calls can render through several different
  // ToolCallGroup mounts across its life (live-only, before any result;
  // merged into the trailing history run once one lands; history-only once
  // settled) -- the toggle lives here, under the round's own permanent key
  // (`roundKeyOf`/`advanceAnchorKeys`), rather than under a toolUseId
  // directly (the model only guarantees a toolUseId is unique within its
  // own response, never across the conversation -- Model/Conversation.ts:
  // 353-357 -- so two different rounds can share one).
  const anchorKeysRef = React.useRef<ReadonlyMap<string, string>>(new Map())
  const pendingLiveRef = React.useRef<PendingLive>()
  const advanced = advanceAnchorKeys(
    anchorKeysRef.current,
    pendingLiveRef.current,
    toolCallGroupIds,
    uuid.v4,
  )
  anchorKeysRef.current = advanced.anchorKeys
  pendingLiveRef.current = advanced.pendingLive
  // Not memoized: it reads mutable refs directly, so a stale closure would
  // still read their current value correctly, and memoizing buys nothing a
  // plain function recreated each render doesn't already give for free.
  const roundKeyFor = (group: ToolCallGroupIds) =>
    roundKeyOf(anchorKeysRef.current, pendingLiveRef.current, group)

  const [expandedByRoundKey, setExpandedByRoundKey] = React.useState<
    ReadonlyMap<string, boolean>
  >(new Map())

  // Plain functions, not memoized: both close over `roundKeyFor` (itself
  // reading mutable refs, not state) and `setExpandedByRoundKey` (whose
  // setter identity React itself guarantees stable), so there is no stale
  // closure risk here to buy back with `useCallback`.
  const toolCallExpanded = (group: ToolCallGroupIds) => {
    const key = roundKeyFor(group)
    return key !== undefined && (expandedByRoundKey.get(key) ?? false)
  }
  const toggleToolCallExpanded = (group: ToolCallGroupIds) => {
    const key = roundKeyFor(group)
    if (key === undefined) return
    setExpandedByRoundKey((prev) => {
      const next = new Map(prev)
      next.set(key, !(prev.get(key) ?? false))
      return next
    })
  }

  return (
    <div className={classes.chat}>
      <div className={classes.header}>
        <span className={classes.qicon}>
          <M.Icon className={classes.qiconGlyph}>auto_awesome</M.Icon>
        </span>
        <div>
          <div className={classes.title}>Qurator</div>
          <div className={classes.subtitle}>Your AI assistant, with your permissions</div>
        </div>
        <Menu
          state={state}
          dispatch={dispatch}
          onToggleDevTools={toggleDevTools}
          devToolsOpen={devToolsOpen}
          className={cx(classes.headerButton, classes.trailing)}
        />
        <M.IconButton
          className={classes.headerButton}
          onClick={onClose}
          size="small"
          aria-label="Close Qurator"
        >
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </div>
      <M.Slide direction="down" mountOnEnter unmountOnExit in={devToolsOpen}>
        <M.Paper square className={classes.devTools}>
          <DevTools
            state={state}
            {...devTools}
            // A failed read sends the stack default, so a typed override would be ignored.
            governed={!!model.allowlist || model.readFailed}
            connectors={connectors}
          />
        </M.Paper>
      </M.Slide>
      <div className={classes.historyContainer}>
        <div className={classes.history}>
          <MessageContainer>
            Hi! I'm Qurator, your AI assistant. Ask me about your packages, buckets and
            data — I can search, query and summarize them for you.
          </MessageContainer>
          {(() => {
            // One list, not two: a standalone live-only round (no history
            // run yet) used to render at a separate JSX call site below
            // this map, so when its first result landed and it became the
            // trailing history run instead, React saw a different element
            // and remounted it from scratch -- dropping focus from
            // whichever ApprovalCard button the user had focused. Folding
            // every rendered item (Message, history ToolCallGroup, and the
            // standalone live-only ToolCallGroup) into one list, each with
            // its own stable key, lets React match the live round to its
            // later history mount by key instead of by position.
            const hasTrailingRun =
              toolCallRuns[toolCallRuns.length - 1]?.[0]._tag === 'ToolUse'
            let groupIndex = -1
            const items = toolCallRuns.map((run, i) =>
              run[0]._tag === 'Message' ? (
                <MessageEvent
                  key={run[0].id}
                  dispatch={dispatch}
                  state={state._tag}
                  {...(run[0] as ReturnType<typeof Model.Conversation.Event.Message>)}
                />
              ) : (
                // Keyed by the registered permanent round key, not the
                // group's own fields directly: a group's anchor changes
                // (undefined -> a real event id) the moment its first call
                // resolves, so keying on `group.anchor ?? group.ids[0]`
                // still changed the React key -- and therefore remounted
                // the group, losing its expanded state and any focus
                // inside it -- on that same transition. `roundKeyOf` reads
                // the one key already registered for this round and never
                // changes it. Live calls join the trailing ToolUse run
                // (same round, partially settled) rather than getting
                // their own group, so a call that finishes while others
                // are still running doesn't fall out of an open toggle.
                (() => {
                  groupIndex += 1
                  const group = toolCallGroupIds[groupIndex]
                  return (
                    <ToolCallGroup
                      key={roundKeyFor(group)}
                      dispatch={dispatch}
                      state={state._tag}
                      events={
                        run as ReturnType<typeof Model.Conversation.Event.ToolUse>[]
                      }
                      live={i === toolCallRuns.length - 1 ? liveToolUse : undefined}
                      expanded={toolCallExpanded(group)}
                      onToggleExpanded={() => toggleToolCallExpanded(group)}
                    />
                  )
                })()
              ),
            )
            // A tool-only turn (no text) leaves `events` unchanged, so the
            // trailing run above can be a Message, or there can be no run
            // at all -- liveToolUse then has nowhere to attach above and
            // needs its own entry in the same list, under the same kind of
            // key its eventual history mount will use.
            if (liveToolUse && !hasTrailingRun) {
              const liveGroup = toolCallGroupIds[toolCallGroupIds.length - 1]
              items.push(
                <ToolCallGroup
                  key={roundKeyFor(liveGroup)}
                  dispatch={dispatch}
                  state={state._tag}
                  events={[]}
                  live={liveToolUse}
                  expanded={toolCallExpanded(liveGroup)}
                  onToggleExpanded={() => toggleToolCallExpanded(liveGroup)}
                />,
              )
            }
            return items
          })()}
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
              <WaitingState dispatch={dispatch} timestamp={s.timestamp} busy={busy} />
            ),
            ToolUse: () => null,
            AwaitingConnector: (s) => (
              <AwaitingConnectorState dispatch={dispatch} timestamp={s.timestamp} />
            ),
          })}
          {composer === 'compact' && !state.events.some((e) => !e.discarded) && (
            <div className={classes.starterGrid}>
              {STARTERS.filter(
                (s) =>
                  (s.icon !== 'hub' ||
                    Object.values(connectors.byId).some((c) =>
                      /deepwiki/i.test(`${c.id} ${c.config.title}`),
                    )) &&
                  (s.icon !== 'edit_note' || mode !== 'ask'),
              ).map((s) => (
                <M.ButtonBase
                  key={s.text}
                  className={classes.starter}
                  onClick={() => setDraft({ text: s.text, at: Date.now() })}
                >
                  <M.Icon className={classes.starterIcon}>{s.icon}</M.Icon>
                  <span>
                    {s.text}
                    {s.hint && <span className={classes.starterHint}>{s.hint}</span>}
                  </span>
                </M.ButtonBase>
              ))}
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>
      {composer === 'compact' && setMode ? (
        <Composer
          api={{ model, connectors, instructions, mode, setMode, skills }}
          disabled={inputDisabled}
          helperText={helperText}
          helperSeverity={helperSeverity}
          onSubmit={ask}
          save={save}
          draft={draft}
        />
      ) : (
        <>
          <Instructions instructions={instructions} />
          <Input
            disabled={inputDisabled}
            model={model}
            skills={skills}
            helperText={helperText}
            helperSeverity={helperSeverity}
            onSubmit={ask}
          />
        </>
      )}
    </div>
  )
}
