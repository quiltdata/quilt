import { IPublicClientApplication, SilentRequest } from '@azure/msal-browser'

/* eslint-disable no-console */

const baseUrl = 'https://quiltdatainc-my.sharepoint.com/'

const params = {
  sdk: '8.0',
  entry: {
    myOrganization: {},
  },
  authentication: {},
  messaging: {
    origin: 'http://localhost:3000',
    channelId: '27',
  },
  typesAndSources: {
    mode: 'files',
    pivots: {
      oneDrive: true,
      recent: true,
    },
  },
}

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

async function getToken(app: IPublicClientApplication, command: TokenCommand) {
  let accessToken = ''
  let authParams = null

  switch (command.type) {
    case 'SharePoint':
    case 'SharePoint_SelfIssued':
      authParams = {
        scopes: [`${combine(command.resource, '.default')}`],
      } as SilentRequest
      break
    default:
      break
  }

  try {
    const resp = await app.acquireTokenSilent(
      authParams || ({ scopes: [] } as SilentRequest),
    )
    accessToken = resp.accessToken
  } catch (e) {
    const resp = await app.loginPopup(authParams || ({ scopes: [] } as SilentRequest))
    app.setActiveAccount(resp.account)

    if (resp.idToken) {
      const resp2 = await app.acquireTokenSilent(
        authParams || ({ scopes: [] } as SilentRequest),
      )
      accessToken = resp2.accessToken
    }
  }

  return accessToken
}

async function messageListener(
  app: IPublicClientApplication,
  win: Window,
  port: MessagePort,
  message: MessageEvent,
) {
  switch (message.data.type) {
    case 'notification':
      console.log(`notification: ${message.data}`)
      break

    case 'command':
      port.postMessage({
        type: 'acknowledge',
        id: message.data.id,
      })

      const command = message.data.data

      switch (command.command) {
        case 'authenticate':
          // getToken is from scripts/auth.js
          const token = await getToken(app, command)

          if (typeof token !== 'undefined' && token !== null) {
            port.postMessage({
              type: 'result',
              id: message.data.id,
              data: {
                result: 'token',
                token,
              },
            })
          } else {
            console.error(
              `Could not get auth token for command: ${JSON.stringify(command)}`,
            )
          }

          break

        case 'close':
          console.log('CLOSE')
          win.close()
          break

        case 'pick':
          console.log(`Picked: ${JSON.stringify(command)}`)

          // document.getElementById('pickedFiles').innerHTML = `<pre>${JSON.stringify(
          //   command,
          //   null,
          //   2,
          // )}</pre>`

          port.postMessage({
            type: 'result',
            id: message.data.id,
            data: {
              result: 'success',
            },
          })

          win.close()

          break

        default:
          console.warn(`Unsupported command: ${JSON.stringify(command)}`, 2)

          port.postMessage({
            result: 'error',
            error: {
              code: 'unsupportedCommand',
              message: command.command,
            },
            isExpected: true,
          })
          break
      }

      break
  }
}

export async function launchPicker(app: IPublicClientApplication) {
  const win = window.open('', 'Picker', 'width=800,height=600')

  const authToken = await getToken(app, {
    resource: baseUrl,
    // command: 'authenticate',
    type: 'SharePoint',
  })
  console.log({ authToken })

  const queryString = new URLSearchParams({
    filePicker: JSON.stringify(params),
  })

  const url = combine(baseUrl, `_layouts/15/FilePicker.aspx?${queryString}`)

  if (!win) return

  const form = win.document.createElement('form')
  form.setAttribute('action', url)
  form.setAttribute('method', 'POST')
  win.document.body.append(form)

  const input = win.document.createElement('input')
  input.setAttribute('type', 'hidden')
  input.setAttribute('name', 'access_token')
  input.setAttribute('value', authToken)
  form.appendChild(input)

  form.submit()

  window.addEventListener('message', (event) => {
    if (event.source && event.source === win) {
      const message = event.data

      if (
        message.type === 'initialize' &&
        message.channelId === params.messaging.channelId
      ) {
        const port = event.ports[0]
        port.addEventListener('message', (m) => messageListener(app, win, port, m))
        port.start()
        port.postMessage({
          type: 'activate',
        })
      }
    }
  })
}
