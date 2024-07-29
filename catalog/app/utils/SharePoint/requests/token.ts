import { IPublicClientApplication } from '@azure/msal-browser'

import cfg from 'constants/config'

export interface AuthToken {
  accessToken: string
  expiresOn: Date | null
  refreshOn?: Date
}

function getAuthParams(hostOpt?: string) {
  const base = hostOpt || cfg.sharePoint.baseUrl
  const host = base.startsWith('http') ? base : `https://${base}`
  return {
    scopes: [`${host}/.default`],
    // TODO: add offline_access, so we can pass refresh_token to server.
    //       I don't see refresh token in token
    //       and I don't see 'offline_access' in list of scopes
    //       when I just added it
    // scopes: [`${host}/.default`, 'offline_access'],
  }
}

export async function getToken(
  app: IPublicClientApplication,
  hostOpt?: string,
): Promise<AuthToken> {
  const authParams = getAuthParams(hostOpt)

  try {
    const resp = await app.acquireTokenSilent(authParams)
    return resp
  } catch (e) {
    const resp = await app.loginPopup(authParams)
    app.setActiveAccount(resp.account)

    if (resp.idToken) {
      const resp2 = await app.acquireTokenSilent(authParams)
      return resp2
    }
  }

  throw new Error('Failed to get token')
}

export function getTokenSilent(
  app: IPublicClientApplication,
  hostOpt?: string,
): Promise<AuthToken> {
  const authParams = getAuthParams(hostOpt)
  return app.acquireTokenSilent(authParams)
}

export async function getTokenPopup(
  app: IPublicClientApplication,
  hostOpt?: string,
): Promise<AuthToken> {
  const authParams = getAuthParams(hostOpt)
  const resp = await app.loginPopup(authParams)
  app.setActiveAccount(resp.account)

  if (resp.idToken) {
    return app.acquireTokenSilent(authParams)
  } else {
    throw new Error('No idToken')
  }
}
