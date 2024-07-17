import { IPublicClientApplication } from '@azure/msal-browser'
import * as uuid from 'uuid'

import * as Model from 'model'

import { BASE_URL } from './constants'
import getToken from './token'

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

function resolveSelection(
  items: PickerItem[],
  authToken: string,
): Promise<Model.SharePointFile[]>[] {
  return items.map((item) => resolveSelectionItem(item, authToken))
}

const PICKER_OPTIONS = {
  sdk: '8.0',
  entry: {
    myOrganization: {},
  },
  authentication: {},
  messaging: {
    origin: `${window.location.protocol}//${window.location.host}`,
    channelId: uuid.v1(),
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
          // TODO:
          // Return unresolved promise with circular structures?
          // So, we can resolve and fetch data in PackageDialog?
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

function requestPicker(win: Window, accessToken: string) {
  const queryString = new URLSearchParams({
    filePicker: JSON.stringify(PICKER_OPTIONS),
  })
  const url = `${BASE_URL}/_layouts/15/FilePicker.aspx?${queryString}`

  const form = win.document.createElement('form')
  form.setAttribute('action', url)
  form.setAttribute('method', 'POST')
  win.document.body.append(form)

  const input = win.document.createElement('input')
  input.setAttribute('type', 'hidden')
  input.setAttribute('name', 'access_token')
  input.setAttribute('value', accessToken)
  form.appendChild(input)

  form.submit()
}

// Must be normal non-async function. Otherwise, popup will not open.
export function launchPicker(
  app: IPublicClientApplication,
  dispatcher: Dispatcher,
  authToken: string,
) {
  const win = window.open('', 'Picker', 'width=800,height=600')

  if (!win) return

  requestPicker(win, authToken)

  window.addEventListener('message', (event) => {
    if (event.source && event.source === win) {
      const message = event.data

      if (
        message.type === 'initialize' &&
        message.channelId === PICKER_OPTIONS.messaging.channelId
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
