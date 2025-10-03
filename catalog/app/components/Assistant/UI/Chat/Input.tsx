import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { createCustomAppTheme } from 'constants/style'

import type { CumulativeUsage } from '../../Utils/TokenCounter'
import { MCPServerConfigRefactored } from '../../MCP/MCPServerConfigRefactored'
import { MCPServerSelectorRedesigned } from '../../MCP/MCPServerSelectorRedesigned'
import ContextMeter from '../ContextMeter/ContextMeter'

import { ContextMenu } from './ContextMenu'

const useStyles = M.makeStyles((t) => ({
  input: {
    alignItems: 'center',
    display: 'flex',
    paddingLeft: `${t.spacing(2)}px`,
    paddingRight: `${t.spacing(2)}px`,
  },
  textField: {
    marginTop: 0,
  },
  hint: {
    color: t.palette.text.hint,
  },
  cursorStyleContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: 16,
    border: '1px solid rgba(107, 79, 207, 0.2)',
    boxShadow: '0 8px 32px rgba(48, 31, 116, 0.12)',
    overflow: 'hidden',
    flexShrink: 0, // Prevent container from shrinking
    minHeight: 120, // Ensure minimum height
  },
  cursorInputArea: {
    position: 'relative',
    minHeight: 120,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
  },
  cursorTextField: {
    '& .MuiInputBase-root': {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      color: '#2d2753',
      background: 'transparent',
      border: 'none',
      padding: 0,
      '&:before, &:after': {
        display: 'none',
      },
      '&:hover:before, &:hover:after': {
        display: 'none',
      },
    },
    '& .MuiInputBase-input': {
      padding: 0,
      fontSize: '0.875rem',
      lineHeight: 1.5,
      color: '#2d2753',
      '&::placeholder': {
        color: 'rgba(45, 39, 83, 0.5)',
        opacity: 1,
      },
    },
  },
  cursorToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid rgba(210, 202, 244, 0.3)',
    background: 'rgba(247, 244, 255, 0.6)',
    flexShrink: 0,
    minHeight: 48,
  },
  cursorToolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cursorToolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cursorToolButton: {
    padding: '6px 12px',
    borderRadius: 8,
    background: 'rgba(107, 79, 207, 0.1)',
    border: '1px solid rgba(107, 79, 207, 0.2)',
    color: '#6b4fcf',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.15)',
      borderColor: 'rgba(107, 79, 207, 0.3)',
    },
  },
  topRightButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  copyButton: {
    padding: 6,
    borderRadius: 6,
    background: 'rgba(107, 79, 207, 0.1)',
    border: '1px solid rgba(107, 79, 207, 0.2)',
    color: '#6b4fcf',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(107, 79, 207, 0.15)',
      borderColor: 'rgba(107, 79, 207, 0.3)',
    },
  },
  copyButtonIcon: {
    fontSize: 16,
  },
  contextMeter: {
    // Context meter styling handled by ContextMeter component
  },
  sendButton: {
    padding: 8,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #6b4fcf 0%, #8f6fff 100%)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(107, 79, 207, 0.3)',
    },
    '&:disabled': {
      background: 'rgba(107, 79, 207, 0.3)',
      cursor: 'not-allowed',
      transform: 'none',
      boxShadow: 'none',
    },
  },
  sendButtonIcon: {
    fontSize: 18,
  },
}))

const backgroundColor = M.colors.indigo[900]
const backgroundColorLt = M.lighten(backgroundColor, 0.1)

const useInputStyles = M.makeStyles({
  focused: {},
  disabled: {},
  root: {
    backgroundColor,
    borderRadius: '8px',
    color: M.fade(M.colors.common.white, 0.8),
    '&:hover': {
      backgroundColor: backgroundColorLt,
      // Reset on touch devices, it doesn't add specificity
      '@media (hover: none)': {
        backgroundColor,
      },
    },
    '&$focused': {
      backgroundColor,
    },
    '&$disabled': {
      backgroundColor: backgroundColorLt,
    },
  },
})

const useLabelStyles = M.makeStyles({
  focused: {},
  root: {
    color: M.fade(M.colors.common.white, 0.6),
    '&$focused': {
      color: M.fade(M.colors.common.white, 0.6),
    },
  },
})

const darkTheme = createCustomAppTheme({ palette: { type: 'dark' } } as any)

interface ChatInputProps {
  className?: string
  disabled?: boolean
  onSubmit: (value: string) => void
  buckets?: string[]
  chatHistory?: Array<{ role: string; content: string; timestamp?: Date }>
  onCopyHistory?: () => void
  onStop?: () => void
  isRunning?: boolean
  contextUsage?: CumulativeUsage | null
}

export default function ChatInput({
  className,
  disabled,
  onSubmit,
  buckets = [],
  chatHistory = [],
  onCopyHistory,
  onStop,
  isRunning = false,
  contextUsage,
}: ChatInputProps) {
  const classes = useStyles()
  const inputStyles = useInputStyles()
  const labelStyles = useLabelStyles()

  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [configDialogOpen, setConfigDialogOpen] = React.useState(false)
  const useCursorStyle = true // Always use cursor-style input

  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      if (!value || disabled) return
      onSubmit(value)
      setValue('')
    },
    [disabled, onSubmit, value],
  )

  const handleStop = React.useCallback(
    (event) => {
      event.preventDefault()
      if (onStop) {
        onStop()
      }
    },
    [onStop],
  )

  const handleSaveServer = React.useCallback((config: any) => {
    // Save server config to localStorage
    const existing = localStorage.getItem('mcp-additional-servers')
    const servers = existing ? JSON.parse(existing) : []
    servers.push(config)
    localStorage.setItem('mcp-additional-servers', JSON.stringify(servers))
  }, [])

  const handleCopyHistory = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (chatHistory.length === 0) {
        return
      }

      try {
        const historyText = chatHistory
          .map((message) => {
            const role = message.role === 'user' ? 'User' : 'Qurator'
            const timestamp = message.timestamp
              ? message.timestamp.toLocaleString()
              : new Date().toLocaleString()
            return `[${timestamp}] ${role}: ${message.content}`
          })
          .join('\n\n')

        await navigator.clipboard.writeText(historyText)

        // Show visual feedback
        const button = e.currentTarget as HTMLElement
        const originalHTML = button.innerHTML
        button.innerHTML = '<span style="color: #4CAF50; font-size: 16px;">✓</span>'
        setTimeout(() => {
          button.innerHTML = originalHTML
        }, 2000)
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = chatHistory
          .map((message) => {
            const role = message.role === 'user' ? 'User' : 'Qurator'
            const timestamp = message.timestamp
              ? message.timestamp.toLocaleString()
              : new Date().toLocaleString()
            return `[${timestamp}] ${role}: ${message.content}`
          })
          .join('\n\n')
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        // Show visual feedback for fallback too
        const button = e.currentTarget as HTMLElement
        const originalHTML = button.innerHTML
        button.innerHTML = '<span style="color: #4CAF50; font-size: 16px;">✓</span>'
        setTimeout(() => {
          button.innerHTML = originalHTML
        }, 2000)
      }

      if (onCopyHistory) {
        onCopyHistory()
      }
    },
    [chatHistory, onCopyHistory],
  )

  if (useCursorStyle) {
    return (
      <>
        <div className={classes.cursorStyleContainer}>
          {/* Main input area */}
          <div className={classes.cursorInputArea}>
            {/* Top right buttons: Context meter and Copy button */}
            {(contextUsage || chatHistory.length > 0) && (
              <div className={classes.topRightButtons}>
                {contextUsage && (
                  <ContextMeter usage={contextUsage} className={classes.contextMeter} />
                )}
                {chatHistory.length > 0 && (
                  <button
                    className={classes.copyButton}
                    onClick={handleCopyHistory}
                    title="Copy chat history"
                    data-copy-button
                  >
                    <M.Icon className={classes.copyButtonIcon}>content_copy</M.Icon>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <ContextMenu
                inputRef={inputRef}
                value={value}
                onChange={setValue}
                buckets={buckets}
              />
              <M.TextField
                inputRef={inputRef}
                className={classes.cursorTextField}
                onChange={(e) => setValue(e.target.value)}
                value={value}
                variant="standard"
                autoFocus
                fullWidth
                multiline
                rows={3}
                placeholder="Ask Qurator (type @ for buckets)"
                InputProps={{
                  disableUnderline: true,
                  style: { fontSize: '0.875rem' },
                  onKeyDown: (e) => {
                    // Submit on Enter (but not Shift+Enter)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  },
                }}
              />
            </form>
          </div>

          {/* Simplified toolbar with only functional elements */}
          <div className={classes.cursorToolbar}>
            <div className={classes.cursorToolbarLeft}>
              {/* Left side empty for now */}
            </div>

            <div className={classes.cursorToolbarRight}>
              <MCPServerSelectorRedesigned
                onConfigureServers={() => setConfigDialogOpen(true)}
              />
              <button
                className={classes.sendButton}
                disabled={disabled || (!isRunning && !value)}
                onClick={isRunning ? handleStop : handleSubmit}
                title={isRunning ? 'Stop query' : 'Send message'}
                style={{
                  backgroundColor: isRunning ? '#f44336' : undefined,
                }}
              >
                <M.Icon className={classes.sendButtonIcon}>
                  {isRunning ? 'stop' : 'arrow_upward'}
                </M.Icon>
              </button>
            </div>
          </div>
        </div>

        <MCPServerConfigRefactored
          open={configDialogOpen}
          onClose={() => setConfigDialogOpen(false)}
          onSaveServer={handleSaveServer}
        />
      </>
    )
  }

  // Fallback to original design
  return (
    <>
      <div style={{ position: 'relative' }}>
        <form
          className={cx(classes.input, className)}
          onSubmit={handleSubmit}
          style={{ position: 'relative' }}
        >
          <ContextMenu
            inputRef={inputRef}
            value={value}
            onChange={setValue}
            buckets={buckets}
          />
          <M.ThemeProvider theme={darkTheme}>
            <M.TextField
              inputRef={inputRef}
              className={classes.textField}
              onChange={(e) => setValue(e.target.value)}
              value={value}
              variant="filled"
              autoFocus
              fullWidth
              margin="normal"
              label="Ask Qurator (type @ for buckets)"
              helperText="Qurator may make errors. Verify important information."
              InputProps={{
                disableUnderline: true,
                classes: inputStyles,
                endAdornment: (
                  <M.InputAdornment position="end">
                    <M.IconButton
                      disabled={disabled || (!isRunning && !value)}
                      onClick={isRunning ? handleStop : handleSubmit}
                      type={isRunning ? 'button' : 'submit'}
                      edge="end"
                      title={isRunning ? 'Stop query' : 'Send message'}
                      style={{
                        backgroundColor: isRunning ? '#f44336' : 'transparent',
                        color: isRunning ? 'white' : undefined,
                      }}
                    >
                      <M.Icon style={{ opacity: 0.7 }}>
                        {isRunning ? 'stop' : 'arrow_circle_up'}
                      </M.Icon>
                    </M.IconButton>
                  </M.InputAdornment>
                ),
              }}
              InputLabelProps={{ classes: labelStyles }}
              FormHelperTextProps={{ classes: { root: classes.hint } }}
            />
          </M.ThemeProvider>
        </form>

        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 16,
            zIndex: 1,
            pointerEvents: 'auto',
          }}
        >
          <MCPServerSelectorRedesigned
            onConfigureServers={() => setConfigDialogOpen(true)}
          />
        </div>
      </div>

      <MCPServerConfigRefactored
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSaveServer={handleSaveServer}
      />
    </>
  )
}
