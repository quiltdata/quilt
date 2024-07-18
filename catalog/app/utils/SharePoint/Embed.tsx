import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import cfg from 'constants/config'
import type * as Model from 'model'

import { useSharePoint } from './Provider'
import { postSigned } from './requests'
import getToken from './token'

const useEmbedSkeletonStyles = M.makeStyles((t) => ({
  root: {
    // display: 'flex',
    // flexDirection: 'column',
  },
  header: {
    height: t.spacing(6),
  },
  body: {
    padding: '20px',
  },
  content: {
    height: t.spacing(70),
  },
}))

function EmbedSkeleton() {
  const classes = useEmbedSkeletonStyles()

  return (
    <div className={classes.root}>
      <Skeleton className={classes.header} />
      <div className={classes.body}>
        <Skeleton className={classes.content} />
      </div>
    </div>
  )
}

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
  return uri ? <iframe width="100%" height="600px" src={uri} /> : <EmbedSkeleton />
}
