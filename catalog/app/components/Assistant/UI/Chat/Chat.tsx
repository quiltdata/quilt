import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
// import * as Lab from '@material-ui/lab'

import Markdown from 'components/Markdown'

import * as Model from '../../Model'

import Input from './Input'
import backgroundPattern from './bg.svg'

const USER_BG = M.colors.cyan[100]

const useMessageContainerStyles = M.makeStyles((t) => ({
  role_user: {},
  role_assistant: {},
  messageContainer: {
    alignItems: 'flex-end',
    display: 'flex',
    gap: `${t.spacing(1)}px`,
    '&$role_user': {
      alignSelf: 'flex-end',
      flexFlow: 'row-reverse',
    },
    '&$role_assistant': {
      alignSelf: 'flex-start',
    },
  },
  avatar: {
    color: t.palette.text.primary,
    height: `${t.spacing(4)}px`,
    width: `${t.spacing(4)}px`,
    '$role_user &': {
      background: USER_BG,
    },
    '$role_assistant &': {
      background: t.palette.background.paper,
    },
  },
  contentArea: {
    borderRadius: `${t.spacing(1)}px`,
    '$role_user &': {
      background: USER_BG,
      borderBottomRightRadius: 0,
    },
    '$role_assistant &': {
      background: t.palette.background.paper,
      borderBottomLeftRadius: 0,
    },
  },
  contents: {
    ...t.typography.body2,
    color: t.palette.text.primary,
    padding: `${t.spacing(1.5)}px`,
  },
  footer: {
    ...t.typography.caption,
    color: t.palette.text.hint,
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'flex-end',
    padding: t.spacing(0, 1.5, 1, 1.5),
    marginTop: t.spacing(-1.5),
  },
  actions: {
    opacity: 0.5,
    '$messageContainer:hover &': {
      opacity: 1,
    },
  },
  spacer: {
    flexShrink: 0,
    width: `${t.spacing(4)}px`,
  },
}))

interface MessageContainerProps {
  role: 'user' | 'assistant'
  children: React.ReactNode
  actions?: React.ReactNode
  timestamp?: Date
}

function MessageContainer({ role, children, actions, timestamp }: MessageContainerProps) {
  const classes = useMessageContainerStyles()
  return (
    <div className={cx(classes.messageContainer, classes[`role_${role}`])}>
      <M.Avatar className={classes.avatar}>
        <M.Icon fontSize="small">{role === 'user' ? 'person' : 'assistant'}</M.Icon>
      </M.Avatar>
      <div className={classes.contentArea}>
        <div className={classes.contents}>{children}</div>
        {!!(actions || timestamp) && (
          <div className={classes.footer}>
            {!!actions && <div className={classes.actions}>{actions}</div>}
            {timestamp && <span>{timestamp.toLocaleTimeString()}</span>}
          </div>
        )}
      </div>
      <div className={classes.spacer} />
    </div>
  )
}

const useMessageActionStyles = M.makeStyles({
  action: {
    cursor: 'pointer',
    opacity: 0.5,
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

interface MessageSharedProps {
  dispatch: ConversationDispatch
  state: Model.Conversation.State['_tag']
}

function Message({
  state,
  id,
  timestamp,
  dispatch,
  role,
  content,
}: MessageSharedProps & ReturnType<typeof Model.Conversation.Event.Message>) {
  const discard = React.useMemo(
    () =>
      state === 'Idle' ? () => dispatch(Model.Conversation.Action.Discard({ id })) : null,
    [dispatch, id, state],
  )
  return (
    <MessageContainer
      role={role}
      actions={<>{discard && <MessageAction onClick={discard}>discard</MessageAction>}</>}
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

type ToolUseEvent = ReturnType<typeof Model.Conversation.Event.ToolUse>
interface ToolUseProps
  extends MessageSharedProps,
    Omit<ToolUseEvent, '_tag' | 'timestamp' | 'id' | 'result'> {
  result?: ToolUseEvent['result']
}

function ToolUse({
  // id,
  // timestamp,
  toolUseId,
  name,
  input,
  result, // dispatch,
}: ToolUseProps) {
  const details = (
    <>
      <b>Tool Use ID:</b> {toolUseId}
      <br />
      <b>Tool Name:</b> {name}
      <br />
      <b>Input:</b>
      <pre>{JSON.stringify(input, null, 2)}</pre>
      {!!result && (
        <>
          <b>Result:</b>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </>
      )}
    </>
  )
  return (
    <MessageContainer role="assistant">
      <M.Tooltip title={details}>
        <span>
          Tool Use: <b>{name}</b> ({result?.status ?? 'in progress'})
        </span>
      </M.Tooltip>
    </MessageContainer>
  )
}

// const useHistoryStyles = M.makeStyles((t) => ({
//   assistant: {
//     animation: `$show 300ms ease-out`,
//   },
//   message: {
//     '& + &': {
//       marginTop: t.spacing(2),
//     },
//   },
//   user: {
//     animation: `$slide 150ms ease-out`,
//     marginLeft: 'auto',
//     width: '60%',
//   },
//   '@keyframes slide': {
//     '0%': {
//       transform: `translateX($${t.spacing(8)}px)`,
//     },
//     '100%': {
//       transform: `translateX(0)`,
//     },
//   },
//   '@keyframes show': {
//     '0%': {
//       opacity: 0.7,
//     },
//     '100%': {
//       opacity: '1',
//     },
//   },
// }))

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
    background: `url("${backgroundPattern}") ${t.palette.grey[700]}`,
    display: 'flex',
    flexDirection: 'column',
    gap: `${t.spacing(2)}px`,
    justifyContent: 'flex-end',
    minHeight: '100%',
    padding: `${t.spacing(2)}px`,
  },
  input: {},
}))

interface ChatProps {
  state: Model.Conversation.State
  dispatch: ConversationDispatch
}

export default function Chat({ state, dispatch }: ChatProps) {
  const classes = useChatStyles()

  const inputDisabled = state._tag != 'Idle'

  // XXX: scroll to new message
  // const ref = React.useRef<HTMLDivElement | null>(null)
  // usePrevious(messages, (prev) => {
  //   if (prev && messages.length > prev.length) {
  //     ref.current?.scroll({
  //       top: ref.current?.firstElementChild?.clientHeight,
  //       behavior: 'smooth',
  //     })
  //   }
  // })

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
          <MessageContainer role="assistant">
            Hi! I'm Qurator, your AI assistant. How can I help you?
          </MessageContainer>
          {state.events
            .filter((e) => !e.discarded)
            .map(
              Model.Conversation.Event.$match({
                Message: (event) => (
                  <Message
                    state={state._tag}
                    key={event.id}
                    dispatch={dispatch}
                    {...event}
                  />
                ),
                ToolUse: (event) => (
                  <ToolUse
                    state={state._tag}
                    key={event.id}
                    dispatch={dispatch}
                    {...event}
                  />
                ),
              }),
            )}
          {Model.Conversation.State.$match(state, {
            Idle: (s) =>
              Eff.Option.match(s.error, {
                onSome: (e) => (
                  <MessageContainer role="assistant">
                    Error occurred:
                    {e.message}
                    {e.details}
                  </MessageContainer>
                  // TODO: retry / discard
                ),
                onNone: () => null,
              }),
            WaitingForAssistant: () => (
              <MessageContainer role="assistant">Processing...</MessageContainer>
            ),
            ToolUse: ({ calls }) =>
              Object.entries(calls).map(([id, call]) => (
                <ToolUse
                  state={state._tag}
                  key={id}
                  dispatch={dispatch}
                  toolUseId={id}
                  {...call}
                />
              )),
          })}
        </div>
      </div>
      <Input className={classes.input} disabled={inputDisabled} onSubmit={ask} />
    </div>
  )
}
