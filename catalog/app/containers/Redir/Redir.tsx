import invariant from 'invariant'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Empty from 'components/Empty'
import Layout from 'components/Layout'
import * as UriResolver from 'containers/UriResolver'
import MetaTitle from 'utils/MetaTitle'
import * as PackageUri from 'utils/PackageUri'

interface OpenInDesktopProps {
  href: string
}

function OpenInDesktop({ href }: OpenInDesktopProps) {
  return (
    <>
      <M.Button color="primary" component="a" href={href} variant="contained">
        Open QuiltSync
      </M.Button>

      <M.Typography>
        Click the button if you’re not redirected automatically.
      </M.Typography>
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(6, 0),
  },
}))

interface WaitingScreenProps {
  uri: PackageUri.PackageUri
  className: string
}

function WaitingScreen({ className, uri }: WaitingScreenProps) {
  return (
    <Empty
      className={className}
      title="Redirecting…"
      description={<OpenInDesktop href={PackageUri.stringify(uri)} />}
    />
  )
}

interface RedirectFailedProps {
  className: string
  error: PackageUri.PackageUriError
}

function RedirectFailed({ className, error }: RedirectFailedProps) {
  return (
    <Empty
      className={className}
      title="Failed to redirect"
      description={<OpenInDesktop href="quilt+s3://" />}
    >
      <M.Typography color="error">
        Error parsing URI: {error.msg || `${error}`}
      </M.Typography>
    </Empty>
  )
}

function useUriResolver(decoded: string) {
  return React.useMemo(() => {
    try {
      return PackageUri.parse(decoded)
    } catch (e) {
      return e as unknown as PackageUri.PackageUriError
    }
  }, [decoded])
}

export default function Redir() {
  const params = useParams<{ uri?: string }>()

  invariant(params.uri, '`uri` must be defined')

  const classes = useStyles()

  const decoded = decodeURIComponent(params.uri || '')
  const uri = useUriResolver(decoded)

  const [redirecting, setRedirecting] = React.useState<PackageUri.PackageUri | null>(null)
  React.useEffect(() => {
    if (uri instanceof Error) return
    window.location.assign(decoded)
    setTimeout(() => {
      setRedirecting(uri)
    }, 3000)
  }, [decoded, uri])

  if (redirecting) {
    return <UriResolver.Redirect parsed={redirecting} decoded={decoded} />
  }

  // TODO: use children instead of `pre`
  return (
    <Layout
      pre={
        <>
          <MetaTitle>Resolve a Quilt+ URI</MetaTitle>
          {uri instanceof Error ? (
            <RedirectFailed className={classes.root} error={uri} />
          ) : (
            <WaitingScreen className={classes.root} uri={uri} />
          )}
        </>
      }
    />
  )
}
