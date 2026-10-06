import * as React from 'react'
import * as M from '@material-ui/core'
import * as redux from 'react-redux'
import { useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import * as Auth from 'containers/Auth'
import usePrevious from 'utils/usePrevious'

type HsqCommand =
  | ['setPath', string]
  | ['trackPageView']
  | ['identify', { email: string }]

function hsq(...cmd: HsqCommand[]) {
  // eslint-disable-next-line no-underscore-dangle
  const q = ((window as any)._hsq = (window as any)._hsq || [])
  cmd.forEach((c) => q.push(c))
}

const PANEL_ID = 'hs-chat-panel'
/** Also the gutter the page gives up while chat is open (Assistant UI Host). */
export const CHAT_WIDTH = '400px'

const conversations = () => (window as any).HubSpotConversations?.widget

// The widget API exists only after the loader runs; queue until then.
function whenReady(fn: () => void) {
  if (conversations()) fn()
  else ((window as any).hsConversationsOnReady ||= []).push(fn)
}

const useStyles = M.makeStyles((t) => ({
  paper: {
    width: CHAT_WIDTH,
    maxWidth: '100vw',
  },
  header: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    padding: t.spacing(0.5, 0.5, 0.5, 2),
  },
  title: {
    flexGrow: 1,
  },
  panel: {
    flexGrow: 1,
    position: 'relative',
    // HubSpot injects its iframe at 300x150; fill the panel instead.
    '& iframe': {
      border: 0,
      height: '100%',
      left: 0,
      position: 'absolute',
      top: 0,
      width: '100%',
    },
  },
}))

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  title: string
}

function ChatPanel({ open, onClose, title }: ChatPanelProps) {
  const classes = useStyles()
  const closeRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!open) return
    whenReady(() => conversations().load())
    // A persistent drawer does not trap focus; move it in and give it back.
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      whenReady(() => conversations().remove())
      opener?.focus()
    }
  }, [open])

  return (
    <M.Drawer
      anchor="right"
      variant="persistent"
      open={open}
      classes={{ paper: classes.paper }}
    >
      <div className={classes.header}>
        <M.Typography variant="subtitle1" className={classes.title}>
          {title}
        </M.Typography>
        <M.IconButton ref={closeRef} onClick={onClose} aria-label="Close chat">
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </div>
      <div id={PANEL_ID} className={classes.panel} />
    </M.Drawer>
  )
}

interface Chat {
  label: string
  open: boolean
  show: () => void
  hide: () => void
}

const ChatCtx = React.createContext<Chat | null>(null)

export const useChat = () => React.useContext(ChatCtx)

function HubSpotTracker() {
  const location = useLocation()
  const email: string | undefined = redux.useSelector(Auth.selectors.email)
  const path = `${location.pathname}${location.search}`

  React.useEffect(() => {
    // Chat renders only inside ChatPanel, never as the floating launcher that
    // covers catalog controls (pagination). Must be set before the loader runs.
    ;(window as any).hsConversationsSettings = {
      loadImmediately: false,
      inlineEmbedSelector: `#${PANEL_ID}`,
    }
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.id = 'hs-script-loader'
    script.async = true
    script.defer = true
    script.src = `https://js.hs-scripts.com/${cfg.hubspotId}.js`
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  // Track SPA navigations (initial page load is auto-tracked by HubSpot)
  usePrevious(path, (prevPath) => {
    if (prevPath !== undefined && prevPath !== path) {
      hsq(['setPath', path], ['trackPageView'])
    }
  })

  // Identify contact on sign-in
  usePrevious(email, (prevEmail) => {
    if (email && email !== prevEmail) {
      hsq(['identify', { email }], ['trackPageView'])
    }
  })

  return null
}

function HubSpotProvider({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const chat = React.useMemo(
    () => ({
      label: cfg.mode === 'OPEN' ? 'Talk to Sales' : 'Chat with support',
      open,
      show: () => setOpen(true),
      hide: () => setOpen(false),
    }),
    [open],
  )
  return (
    <ChatCtx.Provider value={chat}>
      <HubSpotTracker />
      {children}
      <ChatPanel open={open} onClose={chat.hide} title={chat.label} />
    </ChatCtx.Provider>
  )
}

export default function HubSpot({ children }: { children?: React.ReactNode }) {
  if (!cfg.hubspotId) return <>{children}</>
  return <HubSpotProvider>{children}</HubSpotProvider>
}
