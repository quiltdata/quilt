import * as React from 'react'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import type * as Model from 'model'

import { useSharePoint } from './Provider'
import { postSigned } from './requests'
import getToken from './token'

async function getEmbedUrl(
  authToken: string,
  loc: Model.SharePointLocation,
): Promise<string> {
  const url = `https://${loc.host}/_api/v2.0/drives/${loc.driveId}/items/${loc.id}/preview`
  return (await postSigned(authToken, url)).getUrl
}

interface EmbedProps {
  loc: Model.SharePointLocation
}

export default function Embed({ loc }: EmbedProps) {
  const { msal } = useSharePoint()
  const [uri, setUri] = React.useState<string | null>(null)
  React.useEffect(() => {
    async function loadEmbedUrl() {
      const authToken = await getToken(msal.instance, {
        resource: cfg.sharePoint.baseUrl,
        type: 'SharePoint',
      })
      const embedUrl = await getEmbedUrl(authToken, loc)
      setUri(embedUrl)
    }
    loadEmbedUrl()
  }, [loc, msal])
  return (
    <h1>
      {uri ? (
        <iframe width="100%" height="600px" src={uri} />
      ) : (
        <M.CircularProgress size={96} />
      )}
    </h1>
  )
}
