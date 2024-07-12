import * as React from 'react'
import {
  AuthenticationResult,
  BrowserAuthOptions,
  EventMessage,
  EventType,
  InteractionType,
  PublicClientApplication,
} from '@azure/msal-browser'
import { IMsalContext, useMsal, MsalProvider } from '@azure/msal-react'
import { Client } from '@microsoft/microsoft-graph-client'
import { AuthCodeMSALBrowserAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/authCodeMsalBrowser'

const SCOPES = ['user.read', 'files.read']

interface MSUser {
  id: string
  displayName?: string
}

function ensureClient(
  graphClient: Client | null,
  authProvider: AuthCodeMSALBrowserAuthenticationProvider,
): Client {
  if (!graphClient) {
    graphClient = Client.initWithMiddleware({
      authProvider: authProvider,
    })
  }

  return graphClient
}

function getUser(
  graphClient: Client | null,
  authProvider: AuthCodeMSALBrowserAuthenticationProvider,
): Promise<MSUser> {
  const client = ensureClient(graphClient, authProvider)
  return client.api('/me').select('displayName,id').get()
}

interface SharePoint {
  msal: IMsalContext
  signIn: () => Promise<void>
  user: MSUser | Error | null
}

const Ctx = React.createContext<SharePoint | null>(null)

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

function InternalProvider({ children }: React.PropsWithChildren<{}>) {
  const msal = useMsal()

  const [user, setUser] = React.useState<MSUser | Error | null>(null)
  const [client, setClient] = React.useState<Client | null>(null)

  const authProvider = React.useMemo(() => {
    const account = msal.instance.getActiveAccount()
    if (!account) {
      const error = new Error('No active account')
      setUser(error)
      return account
    }

    return new AuthCodeMSALBrowserAuthenticationProvider(
      msal.instance as PublicClientApplication,
      {
        account,
        scopes: SCOPES,
        interactionType: InteractionType.Popup,
      },
    )
  }, [msal.instance])

  React.useEffect(() => {
    if (authProvider) {
      setClient(ensureClient(client, authProvider))
    }
  }, [client, authProvider])

  React.useEffect(() => {
    const checkUser = async () => {
      if (!user) {
        try {
          setUser(null)
          const account = msal.instance.getActiveAccount()
          if (account && authProvider) {
            const found = await getUser(client, authProvider)
            setUser(found)
          }
        } catch (err) {
          setUser(err instanceof Error ? err : new Error(`${err}`))
        }
      }
    }
    if (client && authProvider) {
      checkUser()
    }
  }, [client, authProvider, msal.instance, user])

  const signIn = React.useCallback(async () => {
    await msal.instance.loginPopup({
      scopes: SCOPES,
      prompt: 'select_account',
    })

    if (authProvider) {
      const found = await getUser(client, authProvider)
      setUser(found)
    }
  }, [authProvider, client, msal.instance])

  const value = React.useMemo(() => ({ msal, signIn, user }), [msal, signIn, user])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

interface ProviderProps {
  children: React.ReactNode
  auth: BrowserAuthOptions
}

export function Provider({ auth, children }: ProviderProps) {
  const msal = React.useMemo(() => createMsalInstance(auth), [auth])
  return (
    <MsalProvider instance={msal}>
      <InternalProvider>{children}</InternalProvider>
    </MsalProvider>
  )
}

export function useSharePoint() {
  const ctx = React.useContext(Ctx)
  if (!ctx) {
    throw new Error('useSharePoint must be used within SharePointProvider')
  }
  return ctx
}

export const use = useSharePoint
