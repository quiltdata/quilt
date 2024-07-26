import { IPublicClientApplication } from '@azure/msal-browser'
import * as uuid from 'uuid'

import cfg from 'constants/config'
import * as Model from 'model'
import log from 'utils/Logging'

// FIXME: use SharePoint/requests
import {
  children as listChildren,
  driveItem as getDriveItem,
  versionsList,
} from './client'
import type { DriveItem, PickedItem } from './client/types'
import { AuthToken, getToken } from './token'

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

async function downloadFile(driveItem: DriveItem): Promise<ArrayBuffer> {
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

const parseSelectionItem = (item: PickedItem): SelectionItem => ({
  endpoint: new URL(item['@sharePoint.endpoint']),
  driveId: item.parentReference.driveId,
  id: item.id,
  isDirectory: !!item.folder,
})

function createSharePointLocation(
  driveItem: DriveItem,
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

const parentNameAccum = (name: string, parentName?: string): string =>
  parentName ? `${parentName}/${name}` : name

async function fetchFile(
  authToken: AuthToken,
  driveItem: DriveItem,
  host: string,
  parentName?: string,
): Promise<Model.SharePointFile[]> {
  const versions = await versionsList(
    authToken.accessToken,
    driveItem.id,
    driveItem.parentReference.driveId,
    host,
  )
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
  authToken: AuthToken,
  loc: SelectionItem,
): Promise<Model.SharePointFile[]> {
  const driveItem = await getDriveItem(
    authToken.accessToken,
    loc.id,
    loc.driveId,
    loc.endpoint.hostname,
  )
  return fetchFile(authToken, driveItem, loc.endpoint.hostname)
}

async function resolveDir(
  authToken: AuthToken,
  loc: SelectionItem,
  parentName?: string,
): Promise<Model.SharePointFile[]> {
  const children = await listChildren(
    authToken.accessToken,
    loc.id,
    loc.driveId,
    loc.endpoint.hostname,
  )
  return (
    await Promise.all(
      children.value.map((driveItem) =>
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
  authToken: AuthToken,
  items: PickedItem[],
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
  authToken: AuthToken,
  onSubmit: (files: Model.SharePointFile[]) => void,
) {
  return async (message: MessageEvent) => {
    const payload = message.data
    const id = payload.id

    if (payload.type === 'notification') {
      log.debug(payload.data)
    }

    if (payload.type === 'command') {
      port.postMessage(MESSAGES.ACKNOWLEDGE(id))

      const command = payload.data

      switch (command.command) {
        case 'authenticate': {
          try {
            const token = await getToken(app, command.resource)
            port.postMessage(MESSAGES.TOKEN(id, token.accessToken))
          } catch (e) {
            port.postMessage(
              MESSAGES.ERROR(
                id,
                'unableToAuthenticate',
                e ? e.toString() : 'Unable to authenticate',
              ),
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
            port.postMessage(
              MESSAGES.ERROR(
                id,
                'unableToTraverseFiles',
                e ? e.toString() : 'Unable to traverse selected files',
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

function requestPicker(win: Window, accessToken: AuthToken) {
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
  input.setAttribute('value', accessToken.accessToken)
  form.appendChild(input)

  form.submit()
}

// NOTE: Must be normal non-async function. Otherwise, popup will not open.
export default function launchPicker(
  app: IPublicClientApplication,
  authToken: AuthToken,
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
