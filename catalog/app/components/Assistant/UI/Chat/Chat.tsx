import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import Markdown from 'components/Markdown'
import usePrevious from 'utils/usePrevious'

import * as Model from '../../Model'

import Input from './Input'

const BG = {
  intense: M.colors.indigo[900],
  bright: M.colors.indigo[500],
  faint: M.colors.indigo[50],
}

const useMessageContainerStyles = M.makeStyles((t) => ({
  align_left: {},
  align_right: {},
  color_intense: {},
  color_bright: {},
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
    maxWidth: 'calc(50vw - 32px)',
  },
  contentArea: {
    borderRadius: `${t.spacing(1)}px`,
    '$color_intense &': {
      background: BG.intense,
      color: t.palette.common.white,
    },
    '$color_bright &': {
      background: BG.bright,
      color: t.palette.common.white,
    },
    '$color_faint &': {
      background: BG.faint,
      color: t.palette.text.primary,
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
    padding: t.spacing(1, 0, 0, 2),
  },
  actions: {
    opacity: 0.7,
    '$messageContainer:hover &': {
      opacity: 1,
    },
  },
}))

interface MessageContainerProps {
  color?: 'intense' | 'bright' | 'faint'
  align?: 'left' | 'right'
  children: React.ReactNode
  actions?: React.ReactNode
  timestamp?: Date
}

function MessageContainer({
  color = 'faint',
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

type ConversationDispatch = (action: Model.Conversation.Action) => void

interface ConversationDispatchProps {
  dispatch: ConversationDispatch
}

interface ConversationStateProps {
  state: Model.Conversation.State['_tag']
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
      color={role === 'user' ? 'intense' : 'faint'}
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
    <MessageContainer
      color="bright"
      timestamp={timestamp}
      actions={discard && <MessageAction onClick={discard}>discard</MessageAction>}
    >
      <span>
        Tool Use: <b>{name}</b> ({result.status})
      </span>
      <M.Box py={0.5}>
        <JsonDisplay name="details" value={details} />
      </M.Box>
    </MessageContainer>
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
    <MessageContainer
      color="bright"
      timestamp={timestamp}
      actions={<MessageAction onClick={abort}>abort</MessageAction>}
    >
      <span>
        Tool Use: <b>{names.join(', ')}</b>
      </span>
      <M.Box py={0.5}>
        <JsonDisplay name="details" value={details} />
      </M.Box>
    </MessageContainer>
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
      Processing...
    </MessageContainer>
  )
}

const useChatStyles = M.makeStyles((t) => ({
  chat: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
  header: {
    padding: `${t.spacing(2)}px`,
    paddingBottom: `${t.spacing(1)}px`,
  },
  historyContainer: {
    flexGrow: 1,
    overflowY: 'auto',
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
    padding: `${t.spacing(2)}px`,
    paddingBottom: 0,
  },
  input: {},
}))

interface ChatProps {
  state: Model.Conversation.State
  dispatch: ConversationDispatch
}

export default function Chat({ state, dispatch }: ChatProps) {
  const classes = useChatStyles()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const inputDisabled = state._tag != 'Idle'

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

  return (
    <div className={classes.chat}>
      <div className={classes.header}>
        <M.Typography variant="h4">Qurator</M.Typography>
        <M.Typography variant="caption" color="textSecondary">
          Qurator may make errors. Verify important information.
        </M.Typography>
      </div>
      <div className={classes.historyContainer}>
        <div className={classes.history}>
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
                    Error occurred: {e.message}
                    <div>{e.details}</div>
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
      <Input className={classes.input} disabled={inputDisabled} onSubmit={ask} />
    </div>
  )
}
