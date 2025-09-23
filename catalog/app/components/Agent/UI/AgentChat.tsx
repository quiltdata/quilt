import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Markdown from 'components/Markdown'
import usePrevious from 'utils/usePrevious'

import Input from './Input'

const BG = {
  intense: M.colors.indigo[900],
  bright: M.colors.indigo[500],
  faint: M.colors.common.white,
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
    maxWidth: '100%',
  },
  contentArea: {
    borderRadius: `${t.spacing(1)}px`,
    '$color_intense &': {
      background: BG.intense,
      color: M.fade(t.palette.common.white, 0.8),
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
    paddingLeft: t.spacing(4),
    paddingTop: '6px',
  },
}))

interface MessageContainerProps {
  color?: 'intense' | 'bright' | 'faint'
  align?: 'left' | 'right'
  children: React.ReactNode
  timestamp?: Date
}

function MessageContainer({
  color = 'faint',
  align = 'left',
  children,
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
        {timestamp && (
          <div className={classes.footer}>
            <span>{timestamp.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  chat: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
    height: '600px',
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.spacing(1),
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
  input: {},
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
  },
}))

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AgentChat() {
  const classes = useStyles()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  const messagesFingerprint = messages.map((m) => m.id).join(',')

  usePrevious(messagesFingerprint, (prev) => {
    if (prev && messagesFingerprint !== prev) {
      scrollRef.current?.scrollIntoView({
        block: 'end',
        behavior: 'smooth',
      })
    }
  })

  const handleSubmit = React.useCallback((content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Simulate assistant response (dummy for now)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `This is a dummy response to: "${content}". MCP integration coming soon!`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
  }, [])

  return (
    <div className={classes.chat}>
      <div className={classes.historyContainer}>
        <div className={classes.history}>
          <MessageContainer>
            Hi! I'm the Agent Assistant with MCP capabilities. How can I help you?
          </MessageContainer>

          {messages.map((message) => (
            <MessageContainer
              key={message.id}
              color={message.role === 'user' ? 'intense' : 'faint'}
              align={message.role === 'user' ? 'right' : 'left'}
              timestamp={message.timestamp}
            >
              <Markdown data={message.content} />
            </MessageContainer>
          ))}

          {isLoading && (
            <MessageContainer>
              <div className={classes.loadingContainer}>
                <M.CircularProgress size={16} />
                <span>Processing...</span>
              </div>
            </MessageContainer>
          )}

          <div ref={scrollRef} />
        </div>
      </div>
      <Input
        className={classes.input}
        disabled={isLoading}
        onSubmit={handleSubmit}
        label="Ask Agent"
        helperText="Agent may make errors. Verify important information."
      />
    </div>
  )
}
