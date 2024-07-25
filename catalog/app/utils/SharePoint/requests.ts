import * as React from 'react'

import type * as Model from 'model'

import { useSharePoint } from './Provider'
import getToken from './token'

export interface SharePointDriveItem {
  '@content.downloadUrl'?: string
  '@microsoft.graph.downloadUrl'?: string
  eTag: string
  folder: {}
  id: string
  lastModifiedDateTime?: string
  name: string
  parentReference: {
    id: string
    driveId: string
    name: string
  }
  size?: number
}

export interface SharePointDriveItemVersion {
  '@content.downloadUrl'?: string
  id: string
  lastModifiedDateTime: string
  size: number
}
export interface SharePointDriveItemVersionOutput {
  value: SharePointDriveItemVersion[]
}

export interface DriveItemAttrs {
  lastModified: Date
  size: number
}

export async function makeRequestSigned(
  authToken: string,
  url: RequestInfo | string | URL,
) {
  const response = await window.fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  return response.json()
}

export async function postSigned(authToken: string, url: RequestInfo | string | URL) {
  const response = await window.fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  return response.json()
}

export function getVersionsList(
  authToken: string,
  loc: {
    driveId: string
    host: string
    id: string
  },
): Promise<SharePointDriveItemVersionOutput> {
  const url = `https://${loc.host}/_api/v2.0/drives/${loc.driveId}/items/${loc.id}/versions`
  return makeRequestSigned(authToken, url)
}

// TODO: parse driveItem and use structures similar to exisitng s3 files
//       `lastModified: Date`, in particular
export async function getDriveItemAttrs(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<{ lastModified: Date; size: number }> {
  const versions = await getVersionsList(authToken, loc)
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
  const url = `https://${loc.host}/_api/v2.0/drives/${loc.driveId}/items/${loc.id}/preview`
  return (await postSigned(authToken, url)).getUrl
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
