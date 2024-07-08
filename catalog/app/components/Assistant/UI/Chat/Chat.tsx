import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
// import * as Lab from '@material-ui/lab'

import Markdown from 'components/Markdown'

import * as Model from '../../Model'

import Input from './Input'

type ConversationDispatch = (action: Model.Conversation.Action) => void

interface ConversationDispatchProps {
  dispatch: ConversationDispatch
}

function Message({
  // id,
  // timestamp,
  role,
  content,
}: ConversationDispatchProps & ReturnType<typeof Model.Conversation.Event.Message>) {
  return (
    <MessageContainer role={role}>
      {Model.Content.MessageContentBlock.$match(content, {
        Text: ({ text }) => <Markdown data={text} />,
        Image: ({ format }) => `${format} image`,
        Document: ({ name, format }) => `${format} document "${name}"`,
      })}
    </MessageContainer>
  )
}

function ToolUse({
  // id,
  // timestamp,
  toolUseId,
  name,
  input,
  result, // dispatch,
}: ConversationDispatchProps & ReturnType<typeof Model.Conversation.Event.ToolUse>) {
  const details = (
    <>
      <b>Tool Use ID:</b> {toolUseId}
      <br />
      <b>Tool Name:</b> {name}
      <br />
      <b>Input:</b>
      <pre>{JSON.stringify(input, null, 2)}</pre>
      <b>Result:</b>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </>
  )
  return (
    <MessageContainer role="assistant">
      <M.Tooltip title={details}>
        <span>
          Tool Use: <b>{name}</b> ({result.status})
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
    height: `${t.spacing(4)}px`,
    width: `${t.spacing(4)}px`,
    '$role_user &': {
      background: t.palette.primary.main,
      color: t.palette.primary.contrastText,
    },
    '$role_assistant &': {
      background: t.palette.background.paper,
      color: t.palette.text.primary,
    },
  },
  contents: {
    borderRadius: `${t.spacing(1)}px`,
    padding: `${t.spacing(1.5)}px`,
    ...t.typography.body2,
    '$role_user &': {
      background: t.palette.primary.main,
      borderBottomRightRadius: 0,
      color: t.palette.primary.contrastText,
    },
    '$role_assistant &': {
      background: t.palette.background.paper,
      borderBottomLeftRadius: 0,
      color: t.palette.text.primary,
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
}

function MessageContainer({ role, children }: MessageContainerProps) {
  const classes = useMessageContainerStyles()
  return (
    <div className={cx(classes.messageContainer, classes[`role_${role}`])}>
      <M.Avatar className={classes.avatar}>
        <M.Icon fontSize="small">{role === 'user' ? 'person' : 'assistant'}</M.Icon>
      </M.Avatar>
      <div className={classes.contents}>{children}</div>
      <div className={classes.spacer} />
    </div>
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
    background: M.fade(t.palette.primary.main, 0.2),
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
            Hi! I'm Qurator. How can I help you?
          </MessageContainer>
          {state.events.map(
            Model.Conversation.Event.$match({
              Message: (event) => (
                <Message key={event.id} dispatch={dispatch} {...event} />
              ),
              ToolUse: (event) => (
                <ToolUse key={event.id} dispatch={dispatch} {...event} />
              ),
            }),
          )}
          {Model.Conversation.State.$match(state, {
            Idle: () => null,
            WaitingForAssistant: () => (
              <MessageContainer role="assistant">Thinking...</MessageContainer>
            ),
            ToolUse: ({ calls }) => {
              const details = Object.entries(calls).map(([id, call]) => (
                <React.Fragment key={id}>
                  <b>Tool Use ID:</b> {id}
                  <br />
                  <b>Tool Name:</b> {call.name}
                  <br />
                  <b>Input:</b>
                  <pre>{JSON.stringify(call.input, null, 2)}</pre>
                </React.Fragment>
              ))
              return (
                <MessageContainer role="assistant">
                  <M.Tooltip title={details}>
                    <span>Using tools ({calls.length})...</span>
                  </M.Tooltip>
                </MessageContainer>
              )
            },
          })}
        </div>
      </div>
      <Input className={classes.input} disabled={inputDisabled} onSubmit={ask} />
    </div>
  )
}
