import { IPublicClientApplication } from '@azure/msal-browser'

import cfg from 'constants/config'

export default async function getToken(app: IPublicClientApplication, hostOpt?: string) {
  const base = hostOpt || cfg.sharePoint.baseUrl
  const host = base.startsWith('http') ? base : `https://${base}`
  const authParams = {
    scopes: [`${host}/.default`],
  }

  try {
    const resp = await app.acquireTokenSilent(authParams)
    return resp.accessToken
  } catch (e) {
    const resp = await app.loginPopup(authParams)
    app.setActiveAccount(resp.account)

    if (resp.idToken) {
      const resp2 = await app.acquireTokenSilent(authParams)
      return resp2.accessToken
    }
  }

  return ''
}
