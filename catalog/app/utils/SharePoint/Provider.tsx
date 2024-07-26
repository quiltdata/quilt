import * as React from 'react'

import {
  AuthenticationResult,
  BrowserAuthOptions,
  EventMessage,
  EventType,
  PublicClientApplication,
} from '@azure/msal-browser'
import { useMsal, MsalProvider } from '@azure/msal-react'

import cfg from 'constants/config'
import log from 'utils/Logging'

function createMsalInstance(auth: BrowserAuthOptions): PublicClientApplication {
  const msalInstance = new PublicClientApplication({
    auth,
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: true,
    },
  })

  msalInstance.addEventCallback((event: EventMessage) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const authResult = event.payload as AuthenticationResult
      msalInstance.setActiveAccount(authResult.account)
    }
  })
  return msalInstance
}

interface ProviderProps {
  children: React.ReactNode
  auth: BrowserAuthOptions
}

export function Provider({ auth, children }: ProviderProps) {
  const msal = React.useMemo(() => createMsalInstance(auth), [auth])
  return <MsalProvider instance={msal}>{children}</MsalProvider>
}

export type RetryToken = () => void

function useAuthToken(
  app: PublicClientApplication,
  hostOpt?: string,
): [string | undefined, RetryToken] {
  const [authToken, setAuthToken] = React.useState<string | undefined>(undefined)
  const [inc, setInc] = React.useState(0)
  const retry = React.useCallback(() => setInc((i) => i + 1), [])
  React.useEffect(() => {
    const base = hostOpt || cfg.sharePoint.baseUrl
    const host = base.startsWith('http') ? base : `https://${base}`
    const authParams = {
      scopes: [`${host}/.default`],
    }
    if (inc) {
      app.loginPopup(authParams).then((resp) => {
        app.setActiveAccount(resp.account)
        if (resp.idToken) {
          app
            .acquireTokenSilent(authParams)
            .then((resp2) => setAuthToken(resp2.accessToken))
        }
      })
    } else {
      app
        .acquireTokenSilent(authParams)
        .then((resp) => setAuthToken(resp.accessToken))
        .catch(() => log.warn('Unable to get token silently. Need a user interaction'))
    }
  }, [hostOpt, inc, app])
  return [authToken, retry]
}

export function useSharePoint(host?: string) {
  const msal = useMsal()
  const [authToken, retry] = useAuthToken(msal.instance as PublicClientApplication, host)
  return React.useMemo(() => ({ authToken, msal, retry }), [authToken, msal, retry])
}

export const use = useSharePoint
