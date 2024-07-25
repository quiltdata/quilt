import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import type * as Model from 'model'

import { useSharePoint } from './Provider'
import { DriveItemAttrs, loadDriveItemAttrs, loadEmbedUrl } from './requests'

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

const useEmbedPlaceholderStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '600px',
    padding: t.spacing(2),
  },
  header: {
    marginBottom: t.spacing(2),
  },
}))

interface EmbedPlaceholderProps {
  onClick: () => void
}
function EmbedPlaceholder({ onClick }: EmbedPlaceholderProps) {
  const classes = useEmbedPlaceholderStyles()
  return (
    <div className={classes.root}>
      <M.Typography variant="h5" className={classes.header}>
        Unable to obtain SharePoint credentials
      </M.Typography>
      <M.Button onClick={onClick} variant="outlined">
        Click to resolve
      </M.Button>
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
    return <EmbedPlaceholder onClick={retry} />
  }
  return embedUrl ? (
    <iframe width="100%" height="600px" src={embedUrl} />
  ) : (
    <EmbedSkeleton />
  )
}

interface FilePropertiesProps {
  authToken?: string
  loc: Model.SharePointLocation
  retry: () => void
}

export function FileProperties({ authToken, retry, loc }: FilePropertiesProps) {
  const attrs = useFileAttrs(authToken, loc)
  if (!authToken) {
    return (
      <div>
        No size, <M.Button onClick={retry}>click!</M.Button>
      </div>
    )
  }
  return attrs ? <h1>{attrs.toString()}</h1> : <M.CircularProgress />
}

/**
 * @deprecated
 */
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

function useFileAttrs(authToken?: string, loc?: Model.SharePointLocation) {
  const { msal } = useSharePoint()

  const [attrs, setAttrs] = React.useState<DriveItemAttrs | undefined>(undefined)

  React.useEffect(() => {
    async function loadData() {
      if (!loc || !authToken) return
      const loaded = await loadDriveItemAttrs(authToken, loc)
      setAttrs(loaded)
    }
    loadData()
  }, [authToken, loc, msal])

  return attrs
}
