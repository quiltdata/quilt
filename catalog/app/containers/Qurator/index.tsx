import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as SessionSave from 'components/Assistant/Model/SessionSave'
import Chat from 'components/Assistant/UI/Chat/Chat'
import * as InlinePresence from 'components/Assistant/UI/InlinePresence'
import * as Intercom from 'components/Intercom'
import { useFeature } from 'utils/features'
import * as NamedRoutes from 'utils/NamedRoutes'

const isStandalone = () =>
  (window.navigator as { standalone?: boolean }).standalone === true ||
  !!window.matchMedia?.('(display-mode: standalone)').matches

// Only this page carries the manifest, so the rest of the catalog never offers
// to install. Removed on unmount for the same reason.
export function useInstallable(enabled: boolean) {
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
        // A pinch-zoom shrinks the visual viewport too; only the keyboard should.
        vv.scale === 1 && vv.height < window.innerHeight - 1
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
function useInstallHint(): React.ReactNode {
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
    justifyContent: 'flex-end',
    padding: t.spacing(0.5, 2),
  },
  chat: {
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
  },
}))

interface QuratorChatProps {
  api: NonNullable<ReturnType<typeof Assistant.Model.useAssistantAPI>>
  onClose: () => void
  save?: ReturnType<typeof SessionSave.useSessionSave>
}

function QuratorChat({ api, onClose, save }: QuratorChatProps) {
  return (
    // The whole API, not a prop list: a Chat prop added on another branch
    // (e.g. `sessions`) would otherwise reach Chat undefined and crash it.
    <Chat {...api} composer="compact" save={save} onClose={onClose} />
  )
}

// Its own component so the save hook (bucket list, name check) mounts only with the flag on.
function QuratorChatWithSave(props: QuratorChatProps) {
  return <QuratorChat {...props} save={SessionSave.useSessionSave(props.api)} />
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
  const installHint = useInstallHint()
  // Saving is Qurator mode's addition; the page itself stays unflagged.
  const saving = useFeature('qurator-mode')

  return (
    <div className={classes.root} style={frame}>
      {/* Chat's own header carries the mark, the menu and ✕ (back to the
          catalog), so this bar exists only to offer the install. */}
      {api && installHint && <div className={classes.bar}>{installHint}</div>}
      {api ? (
        // Registered presence keeps the global drawer from opening a second copy.
        <InlinePresence.Provide value>
          <div className={classes.chat}>
            {saving ? (
              <QuratorChatWithSave api={api} onClose={toCatalog} />
            ) : (
              <QuratorChat api={api} onClose={toCatalog} />
            )}
          </div>
        </InlinePresence.Provide>
      ) : (
        <M.Box p={4} textAlign="center">
          <M.Typography>Qurator isn&apos;t enabled on this stack.</M.Typography>
          <M.Button onClick={toCatalog}>Open catalog</M.Button>
        </M.Box>
      )}
    </div>
  )
}
