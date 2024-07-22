import * as React from 'react'

import type * as Model from 'model'

import { useSharePoint } from './Provider'
import getToken from './token'

export interface SharePointDriveItem {
  '@content.downloadUrl': string
  eTag: string
  folder: {}
  id: string
  name: string
  lastModifiedDateTime?: string
  parentReference: {
    id: string
    driveId: string
    name: string
  }
  size?: number
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

export function getDriveItem(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<SharePointDriveItem> {
  const url = `https://${loc.host}/_api/v2.0/drives/${loc.driveId}/items/${loc.id}`
  return makeRequestSigned(authToken, url)
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
  const [driveItem, setDriveItem] = React.useState<SharePointDriveItem | undefined>(
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
        const response = await getDriveItem(token, loc)
        setDriveItem(response)
      }
    }

    loadData()
  }, [loc, msal, attrs.embedURL, attrs.driveItem])

  return { authToken, driveItem, embedUrl }
}
