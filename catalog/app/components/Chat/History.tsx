import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import usePrevious from 'utils/usePrevious'
import * as AWS from 'utils/AWS'

import * as Messages from './Message'

const useStyles = M.makeStyles((t) => ({
  assistant: {
    animation: `$show 300ms ease-out`,
  },
  message: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
  user: {
    animation: `$slide 150ms ease-out`,
    marginLeft: 'auto',
    width: '60%',
  },
  '@keyframes slide': {
    '0%': {
      transform: `translateX($${t.spacing(8)}px)`,
    },
    '100%': {
      transform: `translateX(0)`,
    },
  },
  '@keyframes show': {
    '0%': {
      opacity: 0.7,
    },
    '100%': {
      opacity: '1',
    },
  },
}))

interface HistoryProps {
  className?: string
  loading: boolean
  messages: AWS.Bedrock.Message[]
}

export default function History({ className, loading, messages }: HistoryProps) {
  const classes = useStyles()

  const list = React.useMemo(
    () => messages.filter((message) => message.role !== 'system'),
    [messages],
  )

  const ref = React.useRef<HTMLDivElement | null>(null)
  usePrevious(messages, (prev) => {
    if (prev && messages.length > prev.length) {
      ref.current?.scroll({
        top: ref.current?.firstElementChild?.clientHeight,
        behavior: 'smooth',
      })
    }
  })

  return (
    <div className={className} ref={ref}>
      <div /* full height scroll area */>
        {list.map((message, index) => {
          switch (message.role) {
            case 'user':
              return (
                <Messages.User
                  key={`message_${index}`}
                  className={cx(classes.message, classes.user)}
                  content={message.content}
                />
              )
            case 'summarize':
              return (
                <Messages.User
                  key={`message_${index}`}
                  className={cx(classes.message, classes.user)}
                  content="Summarize this document"
                />
              )
            case 'assistant':
              return (
                <Messages.Assistant
                  key={`message_${index}`}
                  className={cx(classes.message, classes.assistant)}
                  content={message.content}
                />
              )
          }
        })}
        {loading && <Messages.Skeleton className={classes.message} />}
      </div>
    </div>
  )
}
