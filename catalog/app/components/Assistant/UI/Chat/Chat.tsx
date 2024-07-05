import * as React from 'react'
import * as M from '@material-ui/core'
// import * as Lab from '@material-ui/lab'

// import Skeleton from 'components/Skeleton'

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
  // XXX: render markdown?
  return (
    <div>
      <b>{role === 'user' ? 'You' : 'Assistant'}</b>: {JSON.stringify(content)}
    </div>
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
  return (
    <div>
      <b>
        {name} ({toolUseId}):
      </b>{' '}
      {JSON.stringify(input)}
      <br />
      <b>Result:</b> {JSON.stringify(result)}
    </div>
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
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
  error: {
    marginTop: t.spacing(2),
  },
  history: {
    ...t.typography.body1,
    maxHeight: t.spacing(70),
    overflowY: 'auto',
  },
  input: {
    marginTop: t.spacing(2),
  },
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
    <div className={classes.root}>
      <div className={classes.history}>
        {state.events.map(
          Model.Conversation.Event.$match({
            Message: (event) => <Message key={event.id} dispatch={dispatch} {...event} />,
            ToolUse: (event) => <ToolUse key={event.id} dispatch={dispatch} {...event} />,
          }),
        )}
      </div>

      <Input className={classes.input} disabled={inputDisabled} onSubmit={ask} />
    </div>
  )
}
