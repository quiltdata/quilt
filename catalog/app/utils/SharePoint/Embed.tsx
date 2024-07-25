import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import type * as Model from 'model'

import { useSharePoint } from './Provider'
import { DriveItemAttrs, loadDriveItemAttrs, loadEmbedUrl } from './requests'
import getToken from './token'

const useEmbedSkeletonStyles = M.makeStyles((t) => ({
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
    <div>
      <Skeleton className={classes.header} />
      <div className={classes.body}>
        <Skeleton className={classes.content} />
      </div>
    </div>
  )
}

interface EmbedProps {
  authToken?: string
  loc: Model.SharePointLocation
  retry: () => void
}

export function Embed({ authToken, retry, loc }: EmbedProps) {
  const embedUrl = useEmbedUrl(authToken, loc)
  if (!authToken) {
    return (
      <M.Button onClick={retry}>
        <M.Icon>get_app</M.Icon>
      </M.Button>
    )
  }
  return embedUrl ? (
    <iframe width="100%" height="600px" src={embedUrl} />
  ) : (
    <EmbedSkeleton />
  )
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
      const token = await getToken(msal.instance, `https://${loc.host}`)
      setAuthToken(token)

      if (attrs.embedURL) {
        const url = await loadEmbedUrl(token, loc)
        setEmbedUrl(url)
      }

      if (attrs.driveItem) {
        const response = await loadDriveItemAttrs(token, loc)
        setDriveItemAttrs(response)
      }
    }

    loadData()
  }, [loc, msal, attrs.embedURL, attrs.driveItem])

  return { authToken, driveItem: driveItemAttrs, embedUrl }
}

export function useAuthToken(host?: string): [string | undefined, () => void] {
  const { msal } = useSharePoint()
  const [authToken, setAuthToken] = React.useState<string | undefined>(undefined)
  const [inc, setInc] = React.useState(0)
  const retry = React.useCallback(() => setInc((i) => i + 1), [])
  React.useEffect(() => {
    const authParams = {
      scopes: [`${host}/.default`],
    }
    if (inc) {
      msal.instance.loginPopup(authParams).then((resp) => {
        msal.instance.setActiveAccount(resp.account)
        if (resp.idToken) {
          msal.instance
            .acquireTokenSilent(authParams)
            .then((resp2) => setAuthToken(resp2.accessToken))
        }
      })
    } else {
      msal.instance
        .acquireTokenSilent(authParams)
        .then((resp) => setAuthToken(resp.accessToken))
    }
  }, [host, inc, msal.instance])
  return [authToken, retry]
}

function useEmbedUrl(authToken?: string, loc?: Model.SharePointLocation) {
  const { msal } = useSharePoint()

  const [embedUrl, setEmbedUrl] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    async function loadData() {
      if (!loc || !authToken) return
      const url = await loadEmbedUrl(authToken, loc)
      setEmbedUrl(url)
    }
    loadData()
  }, [authToken, loc, msal])

  return embedUrl
}
