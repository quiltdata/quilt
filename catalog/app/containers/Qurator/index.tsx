import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import Chat from 'components/Assistant/UI/Chat/Chat'
import * as InlinePresence from 'components/Assistant/UI/InlinePresence'
import * as SessionSave from 'components/Assistant/Model/SessionSave'
import * as Intercom from 'components/Intercom'
import Logo from 'components/Logo'
import * as NamedRoutes from 'utils/NamedRoutes'

const isStandalone = () =>
  (window.navigator as { standalone?: boolean }).standalone === true ||
  !!window.matchMedia?.('(display-mode: standalone)').matches

// Only this page carries the manifest, so the rest of the catalog never offers
// to install. Removed on unmount for the same reason.
function useInstallable(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return
    const tags = [
      ['link', { rel: 'manifest', href: '/qurator.webmanifest' }],
      ['link', { rel: 'apple-touch-icon', href: '/qurator-180.png' }],
      ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
      ['meta', { name: 'apple-mobile-web-app-title', content: 'Qurator' }],
      ['meta', { name: 'theme-color', content: '#ffffff' }],
    ].map(([tag, attrs]) => {
      const el = document.createElement(tag as string)
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v as string))
      return document.head.appendChild(el)
    })
    // Scoped to /qurator, so only pages under it load the worker.
    navigator.serviceWorker?.register('/sw.js', { scope: '/qurator' }).catch(() => {})
    return () => tags.forEach((el) => el.remove())
  }, [enabled])
}

// iOS doesn't shrink `100dvh` for the on-screen keyboard: it pans the page
// instead, which pushes the header off and leaves the composer under the
// keyboard. Size the page to the visible viewport while the keyboard is up.
export function useKeyboardFrame(): React.CSSProperties | undefined {
  const [frame, setFrame] = React.useState<React.CSSProperties>()
  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () =>
      setFrame(
        vv.height < window.innerHeight - 1
          ? { height: vv.height, transform: `translateY(${vv.offsetTop}px)` }
          : undefined,
      )
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return frame
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

// Chrome offers install through this event; iOS Safari only through the Share sheet.
function InstallHint() {
  const [prompt, setPrompt] = React.useState<BeforeInstallPromptEvent | null>(null)
  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])
  if (isStandalone()) return null
  if (prompt) {
    return (
      <M.Button
        size="small"
        color="primary"
        onClick={() => prompt.prompt().finally(() => setPrompt(null))}
      >
        Install
      </M.Button>
    )
  }
  // iPadOS reports a Mac user agent; touch points tell it apart.
  const isIOS =
    /iPhone|iPad/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  if (isIOS) {
    return (
      <M.Typography variant="caption" color="textSecondary">
        Share → Add to Home Screen
      </M.Typography>
    )
  }
  return null
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.default,
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    fallbacks: { height: '100vh' },
    inset: 0,
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    paddingTop: 'env(safe-area-inset-top)',
    position: 'fixed',
    // On phones the composer pads the bottom inset itself.
    [t.breakpoints.up('sm')]: {
      paddingBottom: 'env(safe-area-inset-bottom)',
    },
  },
  bar: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: `${t.spacing(1)}px`,
    padding: t.spacing(1, 2),
  },
  grow: {
    flexGrow: 1,
  },
  chat: {
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
  },
}))

function QuratorChat({
  api,
  onClose,
}: {
  api: Assistant.Model.Assistant.API
  onClose: () => void
}) {
  return (
    <Chat
      {...api}
      composer="compact"
      save={SessionSave.useSessionSave(api)}
      onClose={onClose}
    />
  )
}

export default function Qurator() {
  const classes = useStyles()
  const api = Assistant.Model.useAssistantAPI()
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  useInstallable(!!api)
  Intercom.usePauseVisibilityWhen(true)
  const toCatalog = React.useCallback(() => history.push(urls.home()), [history, urls])
  const frame = useKeyboardFrame()

  return (
    <div className={classes.root} style={frame}>
      <div className={classes.bar}>
        <Logo variant="icon" height="28px" width="28px" />
        <div className={classes.grow} />
        {api && <InstallHint />}
        <M.Button size="small" component={Link} to={urls.home()}>
          Open catalog
        </M.Button>
      </div>
      {api ? (
        // Registered presence keeps the global drawer from opening a second copy.
        <InlinePresence.Provide value>
          <div className={classes.chat}>
            {/* The whole API, not a prop list: a Chat prop added on another branch
                (e.g. `sessions`) would otherwise reach Chat undefined and crash it. */}
            <QuratorChat api={api} onClose={toCatalog} />
          </div>
        </InlinePresence.Provide>
      ) : (
        <M.Box p={4} textAlign="center">
          <M.Typography>Qurator isn&apos;t enabled on this stack.</M.Typography>
        </M.Box>
      )}
    </div>
  )
}
