import * as React from 'react'
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

/** The element HubSpot renders its chat into (Assistant UI's Help panel). */
export const EMBED_ID = 'hs-chat-panel'

const conversations = () => (window as any).HubSpotConversations?.widget

// The widget API exists only after the loader runs. Until then only the latest
// load/remove matters, and a blocked loader never drains the queue, so keep one.
let pending: (() => void) | null = null
function whenReady(fn: () => void) {
  if (conversations()) return fn()
  const queued = pending != null
  pending = fn
  if (queued) return
  ;((window as any).hsConversationsOnReady ||= []).push(() => {
    const run = pending
    pending = null
    run?.()
  })
}

/** Renders HubSpot chat into `#EMBED_ID` while mounted; the element must exist first. */
export function useEmbed() {
  React.useEffect(() => {
    whenReady(() => {
      const w = conversations()
      // `load()` is a no-op while a widget is loaded, which it still is when a
      // close raced an unfinished load: its iframe then sits in the old element.
      if (w.status?.().loaded) w.remove()
      w.load()
    })
    return () => whenReady(() => conversations().remove())
  }, [])
}

interface Chat {
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
    // Chat renders only inside the Help panel, never as the floating launcher
    // that covers catalog controls (pagination). Must be set before the loader runs.
    ;(window as any).hsConversationsSettings = {
      loadImmediately: false,
      inlineEmbedSelector: `#${EMBED_ID}`,
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
    </ChatCtx.Provider>
  )
}

export default function HubSpot({ children }: { children?: React.ReactNode }) {
  if (!cfg.hubspotId) return <>{children}</>
  return <HubSpotProvider>{children}</HubSpotProvider>
}
