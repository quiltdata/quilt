import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'

import cfg from 'constants/config'
import usePrevious from 'utils/usePrevious'

import { SELECTOR } from './Launcher'

// The Intercom command function: callable with arbitrary args (e.g. 'boot',
// 'shutdown', 'update', 'show'), augmented with our own status flags.
export interface IntercomApi {
  (...args: unknown[]): unknown
  dummy: boolean
  isCustom: boolean
  isAvailable: () => boolean
}

// Placeholder queueing the calls made before the Intercom widget loads.
interface IntercomPlaceholder {
  (...args: unknown[]): void
  q: unknown[][]
  c: (args: unknown[]) => void
}

type IntercomUser = { name?: string; email?: string; user_id?: string } | undefined

type UserSelector = (state: unknown) => IntercomUser

declare global {
  interface Window {
    Intercom?: IntercomApi | IntercomPlaceholder
  }
}

const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
)

const dummyIntercomApi: IntercomApi = Object.assign(
  (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log("Trying to call Intercom, but it's unavailable", args)
  },
  {
    dummy: true,
    isCustom: false,
    isAvailable: () => false,
  },
)

const Ctx = React.createContext<IntercomApi>(dummyIntercomApi)

const mkPlaceholder = (): IntercomPlaceholder => {
  const i: IntercomPlaceholder = Object.assign((...args: unknown[]) => i.c(args), {
    q: [] as unknown[][],
    c: (args: unknown[]) => {
      i.q.push(args)
    },
  })
  return i
}

// should return undefined or { name, email, user_id }
const defaultUserSelector: UserSelector = () => undefined

interface APILoaderProps {
  appId: string
  userSelector?: UserSelector
  children: (api: IntercomApi) => React.ReactNode
  [key: string]: unknown
}

function APILoader({
  appId,
  userSelector = defaultUserSelector,
  children,
  ...props
}: APILoaderProps) {
  const settings: Record<string, unknown> = { app_id: appId, ...props }

  if (!window.Intercom) window.Intercom = mkPlaceholder()

  const { current: api } = React.useRef<IntercomApi>(((...args: unknown[]) =>
    window.Intercom!(...args)) as IntercomApi)
  // The ref starts as a bare command function and is augmented with our flags
  // on first render; check presence against a plain record to avoid the type
  // (which always declares the flags) narrowing the guard to `never`.
  const apiKeys = api as unknown as Record<string, unknown>
  if (!('dummy' in apiKeys)) api.dummy = false
  if (!('isAvailable' in apiKeys)) api.isAvailable = () => !!window.Intercom
  api.isCustom = cfg.mode === 'PRODUCT'

  if (api.isCustom) {
    settings.custom_launcher_selector = SELECTOR
    settings.hide_default_launcher = true
  }

  React.useEffect(() => {
    api('boot', settings)

    const s = window.document.createElement('script')
    s.type = 'text/javascript'
    s.async = true
    s.src = `https://widget.intercom.io/widget/${appId}`
    const x = window.document.getElementsByTagName('script')[0]
    x.parentNode!.insertBefore(s, x)

    return () => {
      if (!window.Intercom) return
      api('shutdown')
      delete window.Intercom
    }
    // run this only once, ignore settings changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const user = redux.useSelector(userSelector)

  usePrevious(user, (prevUser) => {
    if (!R.equals(user, prevUser)) {
      if (!user) {
        api('shutdown')
        api('boot', settings)
      } else {
        api('update', { ...settings, ...user })
      }
    }
  })

  return <>{children(api)}</>
}

interface IntercomProviderProps {
  children: React.ReactNode
  userSelector?: UserSelector
  [key: string]: unknown
}

export function IntercomProvider({ children, ...props }: IntercomProviderProps) {
  const { intercomAppId: appId } = cfg
  if (!canUseDOM || !appId || cfg.mode === 'OPEN') {
    return children
  }
  return (
    <APILoader appId={appId} {...props}>
      {(api) => <Ctx.Provider value={api}>{children}</Ctx.Provider>}
    </APILoader>
  )
}

export function useIntercom() {
  return React.useContext(Ctx)
}

export { IntercomProvider as Provider, useIntercom as use }

// Hides or shows __default__ Intercom launcher when the `condition` changes
export function usePauseVisibilityWhen(condition: unknown) {
  const intercom = useIntercom()
  const [isVisible, setVisible] = React.useState(true)
  const showIntercom = React.useCallback(
    (shouldShow: boolean) => {
      if (isVisible === shouldShow) return
      intercom('update', {
        hide_default_launcher: !shouldShow,
      })
      setVisible(shouldShow)
    },
    [intercom, isVisible, setVisible],
  )
  React.useEffect(() => {
    if (intercom.isCustom) return
    if (condition) showIntercom(false)
    return () => showIntercom(true)
  }, [condition, intercom.isCustom, showIntercom])
}
