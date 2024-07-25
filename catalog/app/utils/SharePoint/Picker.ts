import { IPublicClientApplication } from '@azure/msal-browser'
import * as uuid from 'uuid'

import cfg from 'constants/config'
import * as Model from 'model'

import { SharePointDriveItem, getVersionsList, makeRequestSigned } from './requests'
import getToken from './token'

// TODO: handle paginated results

const MESSAGES = {
  TOKEN: (id: string, token: string) => ({
    type: 'result',
    id,
    data: {
      result: 'token',
      token,
    },
  }),
  ERROR: (id: string, code: string, message: string) => ({
    type: 'result',
    id,
    data: {
      result: 'error',
      error: {
        code,
        message,
      },
    },
  }),
  ACKNOWLEDGE: (id: string) => ({
    type: 'acknowledge',
    id,
  }),
  SUCCESS: (id: string) => ({
    type: 'result',
    id,
    data: {
      result: 'success',
    },
  }),
}

async function downloadFile(driveItem: SharePointDriveItem): Promise<ArrayBuffer> {
  const url =
    driveItem['@content.downloadUrl'] || driveItem['@microsoft.graph.downloadUrl']
  if (!url) {
    throw new Error('No `downloadUrl`')
  }
  return (await window.fetch(url)).arrayBuffer()
}

interface SelectionItem {
  driveId: string
  endpoint: URL
  id: string
  isDirectory: boolean
}

const parseSelectionItem = (item: SharePointPickedItem): SelectionItem => ({
  endpoint: new URL(item['@sharePoint.endpoint']),
  driveId: item.parentReference.driveId,
  id: item.id,
  isDirectory: !!item.folder,
})

function createSharePointLocation(
  driveItem: SharePointDriveItem,
  versionId: string,
  host: string,
): Model.SharePointLocation {
  return {
    _tag: 'sharepoint',
    driveId: driveItem.parentReference.driveId,
    versionId,
    host,
    id: driveItem.id,
  }
}

function getDriveItem(
  authToken: string,
  loc: SelectionItem,
): Promise<SharePointDriveItem> {
  const url = `${cfg.sharePoint.baseUrl}/_api/v2.0/drives/${loc.driveId}/items/${loc.id}`
  return makeRequestSigned(authToken, url)
}

async function listChildren(
  authToken: string,
  loc: SelectionItem,
): Promise<SharePointDriveItem[]> {
  const url = `${loc.endpoint.href}/drives/${loc.driveId}/items/${loc.id}/children`
  const { value: list }: { value: SharePointDriveItem[] } = await makeRequestSigned(
    authToken,
    url,
  )
  return list
}

const parentNameAccum = (name: string, parentName?: string): string =>
  parentName ? `${parentName}/${name}` : name

interface SharePointPickedItem {
  '@sharePoint.endpoint': string
  folder?: {}
  id: string
  parentReference: {
    name?: string
    driveId: string
  }
}

async function fetchFile(
  authToken: string,
  driveItem: SharePointDriveItem,
  host: string,
  parentName?: string,
): Promise<Model.SharePointFile[]> {
  const versions = await getVersionsList(authToken, {
    driveId: driveItem.parentReference.driveId,
    host,
    id: driveItem.id,
  })
  const address = createSharePointLocation(driveItem, versions.value[0].id, host)
  const file: Model.SharePointFile = {
    address,
    logicalKey: parentNameAccum(driveItem.name, parentName),
    size: driveItem.size,
    getContent: () => downloadFile(driveItem),
  }
  return [file]
}

async function resolveFile(
  authToken: string,
  loc: SelectionItem,
): Promise<Model.SharePointFile[]> {
  const driveItem = await getDriveItem(authToken, loc)
  return fetchFile(authToken, driveItem, loc.endpoint.hostname)
}

async function resolveDir(
  authToken: string,
  loc: SelectionItem,
  parentName?: string,
): Promise<Model.SharePointFile[]> {
  const list = await listChildren(authToken, loc)
  return (
    await Promise.all(
      list.map((driveItem) =>
        driveItem.folder
          ? resolveDir(
              authToken,
              { ...loc, id: driveItem.id },
              parentNameAccum(driveItem.parentReference.name, parentName),
            )
          : fetchFile(
              authToken,
              driveItem,
              loc.endpoint.hostname,
              parentNameAccum(driveItem.parentReference.name, parentName),
            ),
      ),
    )
  ).flat()
}

async function traverseSelection(
  authToken: string,
  items: SharePointPickedItem[],
): Promise<Model.SharePointFile[]> {
  return (
    await Promise.all(
      items
        .map(parseSelectionItem)
        .map((loc) =>
          loc.isDirectory ? resolveDir(authToken, loc) : resolveFile(authToken, loc),
        ),
    )
  ).flat()
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
      myOrganization: true,
      oneDrive: false,
      recent: true,
      shared: false,
      site: true,
    },
  },
  selection: {
    mode: 'multiple',
  },
}

function createMessageListener(
  app: IPublicClientApplication,
  win: Window,
  port: MessagePort,
  authToken: string,
  onSubmit: (files: Model.SharePointFile[]) => void,
) {
  return async (message: MessageEvent) => {
    const payload = message.data
    const id = payload.id

    if (payload.type === 'notification') {
      /* eslint-disable-next-line no-console */
      console.debug(payload.data)
    }

    if (payload.type === 'command') {
      port.postMessage(MESSAGES.ACKNOWLEDGE(id))

      const command = payload.data

      switch (command.command) {
        case 'authenticate': {
          const token = await getToken(app, command)

          if (token) {
            port.postMessage(MESSAGES.TOKEN(id, token))
          } else {
            port.postMessage(
              MESSAGES.ERROR(id, 'unableToObtainToken', 'Unable to obtain a token'),
            )
          }

          break
        }

        case 'close': {
          win.close()
          break
        }

        case 'pick': {
          try {
            const list = await traverseSelection(authToken, command.items)
            onSubmit(list)

            port.postMessage(MESSAGES.SUCCESS(id))

            win.close()
          } catch (e) {
            /* eslint-disable-next-line no-console */
            console.error(e)
            port.postMessage(
              MESSAGES.ERROR(
                id,
                'unableToTraverseFiles',
                'Unable to traverse selected files',
              ),
            )
          }

          break
        }

        default: {
          port.postMessage(MESSAGES.ERROR(id, 'unsupportedCommand', command.command))
          break
        }
      }
    }
  }
}

function requestPicker(win: Window, accessToken: string) {
  const queryString = new URLSearchParams({
    filePicker: JSON.stringify(PICKER_OPTIONS),
  })
  const url = `${cfg.sharePoint.baseUrl}/_layouts/15/FilePicker.aspx?${queryString}`

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

// NOTE: Must be normal non-async function. Otherwise, popup will not open.
export default function launchPicker(
  app: IPublicClientApplication,
  authToken: string,
  onSubmit: (files: Model.SharePointFile[]) => void,
) {
  // Let's open popup half of the screen width and 2/3 of the screen height
  const width = window.screen.width / 2
  const height = (window.screen.height * 2) / 3
  const win = window.open('', 'Picker', `width=${width},height=${height}`)

  if (!win) return

  requestPicker(win, authToken)

  window.addEventListener('message', (event) => {
    if (event.source !== win) {
      return
    }

    const message = event.data
    if (
      message.type !== 'initialize' &&
      message.channelId !== PICKER_OPTIONS.messaging.channelId
    ) {
      return
    }

    const port = event.ports[0]
    const listener = createMessageListener(app, win, port, authToken, onSubmit)
    port.addEventListener('message', listener)
    port.start()
    port.postMessage({ type: 'activate' })
  })
}
