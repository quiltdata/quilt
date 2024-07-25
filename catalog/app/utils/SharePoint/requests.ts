import * as React from 'react'

import type * as Model from 'model'

import { useSharePoint } from './Provider'
import { preview, versionsList } from './client'
import getToken from './token'

// Requests.ts is a place for functions like
// getDriveItemAttrs => parseDriveItemAttrs(await driveItem)
//
// TODO: make sure no one uses xhrGet/xhrPost
//       and no one uses client#funcs and client#types outside requests.ts

export interface DriveItemAttrs {
  lastModified: Date
  size: number
}

// TODO: parse driveItem and use structures similar to exisitng s3 files
//       `lastModified: Date`, in particular
export async function getDriveItemAttrs(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<{ lastModified: Date; size: number }> {
  const versions = await versionsList(authToken, loc.id, loc.driveId, loc.host)
  const found = versions.value.find(({ id }) => id === loc.versionId)
  if (!found) {
    return Promise.reject(new Error('Version not found'))
  }
  return { lastModified: new Date(found.lastModifiedDateTime), size: found.size }
}

async function getEmbedUrl(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<string> {
  return (await preview(authToken, loc.id, loc.driveId, loc.host)).getUrl
}

interface FileAttributes {
  driveItem?: true
  embedURL?: true
}

export function useFile(
  loc: Model.SharePointLocation | null,
  attrs: FileAttributes = {},
) {
  const { msal } = useSharePoint()

  const [authToken, setAuthToken] = React.useState<string | undefined>(undefined)
  const [embedUrl, setEmbedUrl] = React.useState<string | undefined>(undefined)
  const [driveItemAttrs, setDriveItemAttrs] = React.useState<DriveItemAttrs | undefined>(
    undefined,
  )

  React.useEffect(() => {
    async function loadData() {
      if (!loc) return
      // TODO: request whole data, including expireOn
      //       increment counter on expiration
      const token = await getToken(msal.instance, {
        resource: `https://${loc.host}`,
        type: 'SharePoint',
      })
      setAuthToken(token)

      if (attrs.embedURL) {
        const url = await getEmbedUrl(token, loc)
        setEmbedUrl(url)
      }

      if (attrs.driveItem) {
        const response = await getDriveItemAttrs(token, loc)
        setDriveItemAttrs(response)
      }
    }

    loadData()
  }, [loc, msal, attrs.embedURL, attrs.driveItem])

  return { authToken, driveItem: driveItemAttrs, embedUrl }
}
