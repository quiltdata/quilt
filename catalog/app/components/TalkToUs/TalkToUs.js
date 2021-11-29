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

// const getCalendlyEvent = (e) =>
//   e.data.event &&
//   e.data.event.startsWith('calendly.') &&
//   e.data.event.substring('calendly.'.length)

export function TalkToUsProvider({ children }) {
  const cfg = useConfig()
  const t = useTracker()

  const calendlyP = cfg.calendlyLink ? getCalendlyPromise() : null

  const showPopup = React.useCallback(
    (extra) => {
      t.track('WEB', { type: 'meeting', action: 'popup', ...extra })

      if (!cfg.calendlyLink) {
        // eslint-disable-next-line no-console
        console.warn('Unable to open Calendly popup: missing Config.calendlyLink', extra)
        return
      }

      // function handleCalendlyEvent(e) {
      //   if (getCalendlyEvent(e) === 'event_scheduled') {
      //     t.track('WEB', { type: 'meeting', action: 'scheduled', ...extra })
      //   }
      // }

      calendlyP.then((C) => {
        // const handleClose = () => {
        //   window.removeEventListener('message', handleCalendlyEvent)
        // }
        // window.addEventListener('message', handleCalendlyEvent)
        C.initPopupWidget({ url: cfg.calendlyLink })
      })
    },
    [t, cfg.calendlyLink, calendlyP],
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
