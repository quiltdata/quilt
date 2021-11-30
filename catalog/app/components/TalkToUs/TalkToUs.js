import * as React from 'react'

import { useConfig } from 'utils/Config'
import { useTracker } from 'utils/tracking'

const Ctx = React.createContext()

const CALENDLY_CSS = 'https://assets.calendly.com/assets/external/widget.css'
const CALENDLY_JS = 'https://assets.calendly.com/assets/external/widget.js'

const CALENDLY_PROMISE = Symbol('calendly')

function insertEl(tag, attrs) {
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
          resolve(window.Calendly)
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
  return (eventName, callback) => {
    if (ref.current) {
      window.removeEventListener(eventName, ref.current)
    }
    ref.current = callback
    window.addEventListener(eventName, callback)
  }
}

const getCalendlyEvent = (e) =>
  e?.data?.event?.startsWith('calendly.') && e?.data?.event?.substring('calendly.'.length)

export function TalkToUsProvider({ children }) {
  const cfg = useConfig()
  const t = useTracker()

  const calendlyP = cfg.calendlyLink ? getCalendlyPromise() : null

  const listen = useSingletonListener()

  const showPopup = React.useCallback(
    (extra) => {
      t.track('WEB', { type: 'meeting', action: 'popup', ...extra })

      const handleCalendlyEvent = (e) => {
        if (getCalendlyEvent(e) === 'event_scheduled') {
          t.track('WEB', { type: 'meeting', action: 'scheduled', ...extra })
        }
      }

      if (!cfg.calendlyLink) {
        // eslint-disable-next-line no-console
        console.warn('Unable to open Calendly popup: missing Config.calendlyLink', extra)
        return
      }

      calendlyP.then((C) => {
        listen('message', handleCalendlyEvent)
        C.initPopupWidget({ url: cfg.calendlyLink })
      })
    },
    [t, cfg.calendlyLink, calendlyP, listen],
  )

  return <Ctx.Provider value={showPopup}>{children}</Ctx.Provider>
}

export function useTalkToUs(extra) {
  const ref = React.useRef({
    bound: (localExtra) => ref.current.show(ref.current.extra || localExtra),
  })
  ref.current.show = React.useContext(Ctx)
  ref.current.extra = extra
  return ref.current.bound
}

export { TalkToUsProvider as Provider, useTalkToUs as use }
