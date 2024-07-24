import * as React from 'react'

import {
  AuthenticationResult,
  BrowserAuthOptions,
  EventMessage,
  EventType,
  PublicClientApplication,
} from '@azure/msal-browser'
import { useMsal, MsalProvider } from '@azure/msal-react'

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

export function useSharePoint() {
  const msal = useMsal()
  return React.useMemo(() => ({ msal }), [msal])
}

export const use = useSharePoint
