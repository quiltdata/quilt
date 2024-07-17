import { IPublicClientApplication, SilentRequest } from '@azure/msal-browser'
import * as Model from 'model'

export enum DispatchEventType {
  Submit,
}

export type DispatchEvent = {
  data: Model.SharePointFile[]
  type: DispatchEventType.Submit
}

export type Dispatcher = (event: DispatchEvent) => void

export type Folder = {}

interface PickerItem {
  '@sharePoint.endpoint': string
  folder: Folder
  id: string
  parentReference: {
    name?: string
    driveId: string
  }
}

interface DriveItem {
  '@content.downloadUrl': string
  eTag: string
  folder: Folder
  id: string
  name: string
  parentReference: {
    id: string
    driveId: string
    name: string
  }
  size?: number
}

async function fetchFile(
  driveItem: DriveItem,
  host: string,
  parentReference?: DriveItem['parentReference'],
): Promise<Model.SharePointFile[]> {
  const { '@content.downloadUrl': downloadUrl, eTag: etag, id, name, size } = driveItem
  const contents = (await window.fetch(downloadUrl)).arrayBuffer()
  const address = { host, etag, id }
  const logicalKey = parentReference ? `${parentReference.name}/${name}` : name
  return [{ address, logicalKey, size, contents }]
}

async function resolveFile(
  item: PickerItem,
  authToken: string,
): Promise<Model.SharePointFile[]> {
  const url = new URL(
    `${item['@sharePoint.endpoint']}/drives/${item.parentReference.driveId}/items/${item.id}`,
  )
  const response = await window.fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  const driveItem = await response.json()
  const files = await fetchFile(driveItem, url.hostname)
  return files
}

async function resolveDir(
  item: PickerItem,
  authToken: String,
): Promise<Model.SharePointFile[]> {
  const url = new URL(
    `${item['@sharePoint.endpoint']}/drives/${item.parentReference.driveId}/items/${item.id}/children`,
  )
  const driveItemResponse = await window.fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  const driveItemsList: DriveItem[] = (await driveItemResponse.json()).value
  const contentsResponse = (
    await Promise.all(
      driveItemsList.map((driveItem) => {
        const parentReference = {
          ...driveItem.parentReference,
          name: item.parentReference.name
            ? `${item.parentReference.name}/${driveItem.parentReference.name}`
            : driveItem.parentReference.name,
        }
        return driveItem.folder
          ? resolveDir(
              {
                '@sharePoint.endpoint': item['@sharePoint.endpoint'],
                folder: driveItem.folder,
                id: driveItem.id,
                parentReference,
              },
              authToken,
            )
          : fetchFile(driveItem, url.hostname, parentReference)
      }),
    )
  ).flat()
  return contentsResponse
}

async function resolveSelectionItem(
  item: PickerItem,
  authToken: string,
): Promise<Model.SharePointFile[]> {
  return item.folder ? resolveDir(item, authToken) : resolveFile(item, authToken)
}

// TODO: return Promise<object>
//       object that can reference the same object
//       so we can use recursive structures
//       SharePointDir?
//       SharePointListing?
function resolveSelection(
  items: PickerItem[],
  authToken: string,
): Promise<Model.SharePointFile[]>[] {
  return items.map((item) => resolveSelectionItem(item, authToken))
}

export const BASE_URL = 'https://quiltdatainc-my.sharepoint.com/'

const params = {
  sdk: '8.0',
  entry: {
    myOrganization: {},
  },
  authentication: {},
  messaging: {
    origin: `${window.location.protocol}//${window.location.host}`,
    channelId: '27',
  },
  typesAndSources: {
    mode: 'all',
    pivots: {
      oneDrive: true,
      shared: true,
      myOrganization: true,
      site: true,
      recent: true,
    },
  },
  selection: {
    mode: 'multiple',
  },
  // TODO: How does it work? I download the file for the hash.
  //       Perhaps I can do the same with this configuration property.
  // commands: {
  //   pick: {
  //     action: 'download',
  //   },
  // },
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

export async function getToken(app: IPublicClientApplication, command: TokenCommand) {
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
  dispatcher: Dispatcher,
  authToken: string,
  message: MessageEvent,
) {
  switch (message.data.type) {
    case 'notification':
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
            /* eslint-disable-next-line no-console */
            console.error(
              `Could not get auth token for command: ${JSON.stringify(command)}`,
            )
          }

          break

        case 'close':
          win.close()
          break

        case 'pick':
          const data = await Promise.all(resolveSelection(command.items, authToken))
          dispatcher({ type: DispatchEventType.Submit, data: data.flat() })

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
          /* eslint-disable-next-line no-console */
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

export function launchPicker(
  app: IPublicClientApplication,
  dispatcher: Dispatcher,
  authToken: string,
) {
  const win = window.open('', 'Picker', 'width=800,height=600')

  const queryString = new URLSearchParams({
    filePicker: JSON.stringify(params),
  })

  const url = combine(BASE_URL, `_layouts/15/FilePicker.aspx?${queryString}`)

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
        port.addEventListener('message', (m) =>
          messageListener(app, win, port, dispatcher, authToken, m),
        )
        port.start()
        port.postMessage({
          type: 'activate',
        })
      }
    }
  })
}
