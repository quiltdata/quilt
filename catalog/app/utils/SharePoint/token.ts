import { IPublicClientApplication, SilentRequest } from '@azure/msal-browser'

function combine(...paths: any[]) {
  return paths
    .map((path) => path.replace(/^[\\|/]/, '').replace(/[\\|/]$/, ''))
    .join('/')
    .replace(/\\/g, '/')
}

interface TokenCommand {
  type: string
  resource: string
}

function getAuthParams(command: TokenCommand): SilentRequest {
  switch (command.type) {
    case 'SharePoint':
    case 'SharePoint_SelfIssued':
      return {
        scopes: [`${combine(command.resource, '.default')}`],
      }
    default:
      return { scopes: [] }
  }
}

export default async function getToken(
  app: IPublicClientApplication,
  command: TokenCommand,
) {
  const authParams = getAuthParams(command)

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
