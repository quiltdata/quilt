import * as React from 'react'

import cfg from 'constants/config'
import { useTracker } from 'utils/tracking'

interface Calendly {
  initPopupWidget(options: { url: string }): void
}

interface CalendlyEvent extends Event {
  data: {
    event: string
  }
}

declare global {
  interface Window {
    Calendly?: Calendly
    [CALENDLY_PROMISE]: Promise<Calendly>
  }
}

interface Extra {
  src?: string
}

const Ctx = React.createContext<((extra?: Extra) => void) | null>(null)

const CALENDLY_CSS = 'https://assets.calendly.com/assets/external/widget.css'
const CALENDLY_JS = 'https://assets.calendly.com/assets/external/widget.js'

const CALENDLY_PROMISE = Symbol('calendly')

function insertEl(tag: 'link', attrs: Partial<HTMLLinkElement>): void
function insertEl(tag: 'script', attrs: Partial<HTMLScriptElement>): void
function insertEl(tag: string, attrs: Partial<HTMLElement>) {
  const el = Object.assign(window.document.createElement(tag), attrs)
  window.document.head.appendChild(el)
}

function getCalendlyPromise() {
  if (!window[CALENDLY_PROMISE]) {
    window[CALENDLY_PROMISE] = new Promise((resolve, reject) => {
      if (window.Calendly) {
        resolve(window.Calendly)
        return
      }
      insertEl('script', {
        src: CALENDLY_JS,
        async: true,
        onload: () => {
          if (window.Calendly) {
            resolve(window.Calendly)
          } else {
            reject('Calendly not found')
          }
        },
        onerror: reject,
      })
      insertEl('link', { rel: 'stylesheet', href: CALENDLY_CSS })
    })
  }
  return window[CALENDLY_PROMISE]
}

function useSingletonListener() {
  const ref = React.useRef(null)
  return React.useCallback((eventName, callback) => {
    if (ref.current === callback) return
    if (ref.current) {
      window.removeEventListener(eventName, ref.current)
    }
    ref.current = callback
    window.addEventListener(eventName, callback)
  }, [])
}

const getCalendlyEvent = (e: CalendlyEvent) =>
  e?.data?.event?.startsWith('calendly.') && e?.data?.event?.substring('calendly.'.length)

function useCalendlyLink() {
  return React.useCallback((extra?: Extra) => {
    const src = extra?.src || ''
    switch (src) {
      case 'bioit':
        return 'https://calendly.com/quilt-founders/quilt-at-bio-it-world'
      default:
        return cfg.calendlyLink as string
    }
  }, [])
}

export function TalkToUsProvider({ children }: React.PropsWithChildren<{}>) {
  const t = useTracker()
  const getCalendlyLink = useCalendlyLink()

  const calendlyP = getCalendlyLink() ? getCalendlyPromise() : null

  const listen = useSingletonListener()

  const showPopup = React.useCallback(
    (extra?: Extra) => {
      t.track('WEB', { type: 'meeting', action: 'popup', ...extra })

      const handleCalendlyEvent = (e: CalendlyEvent) => {
        if (getCalendlyEvent(e) === 'event_scheduled') {
          t.track('WEB', { type: 'meeting', action: 'scheduled', ...extra })
        }
      }

      if (!getCalendlyLink(extra) || !calendlyP) {
        // eslint-disable-next-line no-console
        console.warn('Unable to open Calendly popup: missing Config.calendlyLink', extra)
        return
      }

      calendlyP.then((C) => {
        listen('message', handleCalendlyEvent)
        const urlData = new window.URL(getCalendlyLink(extra))
        urlData.searchParams.append('hide_gdpr_banner', '1')
        C.initPopupWidget({ url: urlData.toString() })
      })
    },
    [t, getCalendlyLink, calendlyP, listen],
  )

  return <Ctx.Provider value={showPopup}>{children}</Ctx.Provider>
}

export function useTalkToUs(extra?: Extra) {
  const ref: React.MutableRefObject<{
    extra?: Extra
    show?: ((extra?: Extra) => void) | null
    bound: (extra?: Extra) => void
  }> = React.useRef({
    bound: (localExtra?: Extra) =>
      ref.current.show && ref.current.show(ref.current.extra || localExtra),
  })
  ref.current.show = React.useContext(Ctx)
  ref.current.extra = extra
  return ref.current.bound
}

export { TalkToUsProvider as Provider, useTalkToUs as use }
