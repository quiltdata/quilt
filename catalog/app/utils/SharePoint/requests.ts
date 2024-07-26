import type * as Model from 'model'

import { content, preview, versionsList as versions } from './client'
import type { DriveItemVersionsList, DriveItemVersion } from './client/types'

export interface DriveItemAttrs {
  lastModified: Date
  size: number
}

export async function loadDriveItemAttrs(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<DriveItemAttrs> {
  const versionsList = await versions(authToken, loc.id, loc.driveId, loc.host)
  return parseDriveItemAttrs(versionsList, loc.versionId)
}

export async function loadEmbedUrl(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<string> {
  return (await preview(authToken, loc.id, loc.driveId, loc.host)).getUrl
}

function parseDriveItemAttrs(versionsList: DriveItemVersionsList, versionId?: string) {
  if (versionsList.value.length === 0) {
    throw new Error('No versions found')
  }
  const found = versionId
    ? versionsList.value.find(({ id }) => id === versionId)
    : versionsList.value.reduce(
        (memo, version) => {
          if (!memo) return version
          if (version.id > memo.id) return version
          // if (memo.id > version.id) return memo
          return memo
        },
        null as DriveItemVersion | null,
      )
  if (!found) {
    throw new Error('Version not found')
  }
  return { lastModified: new Date(found.lastModifiedDateTime), size: found.size }
}

export function getDownloadUrl(loc: Model.SharePointLocation) {
  return content(loc.id, loc.driveId, loc.host)
}
