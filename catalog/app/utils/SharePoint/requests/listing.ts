import * as Model from 'model'

import { children, driveItem as getDriveItem, versionsList } from '../client'
import type { DriveItem } from '../client/types'
import type { AuthToken } from './token'

interface SelectionItem {
  driveId: string
  endpoint: URL
  id: string
  isDirectory: boolean
}

const parentNameAccum = (name: string, parentName?: string): string =>
  parentName ? `${parentName}/${name}` : name

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

async function downloadFile(driveItem: DriveItem): Promise<ArrayBuffer> {
  const url =
    driveItem['@content.downloadUrl'] || driveItem['@microsoft.graph.downloadUrl']
  if (!url) {
    throw new Error('No `downloadUrl`')
  }
  return (await window.fetch(url)).arrayBuffer()
}

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

async function resolveDir(
  authToken: AuthToken,
  loc: SelectionItem,
  parentName?: string,
): Promise<Model.SharePointFile[]> {
  const { value } = await children(
    authToken.accessToken,
    loc.id,
    loc.driveId,
    loc.endpoint.hostname,
  )
  return (
    await Promise.all(
      value.map((driveItem) =>
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

export function listSelectionRecursive(
  authToken: AuthToken,
  loc: SelectionItem,
): Promise<Model.SharePointFile[]> {
  return loc.isDirectory ? resolveDir(authToken, loc) : resolveFile(authToken, loc)
}
