import invariant from 'invariant'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Empty from 'components/Empty'
import Layout from 'components/Layout'
import * as UriResolver from 'containers/UriResolver'
import MetaTitle from 'utils/MetaTitle'
import * as PackageUri from 'utils/PackageUri'
import { isError } from 'utils/error'

interface OpenInDesktopProps {
  href: string
}

function OpenInDesktop({ href }: OpenInDesktopProps) {
  return (
    <M.Button color="primary" component="a" href={href} variant="contained">
      Open QuiltSync
    </M.Button>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0),
  },
}))

const REDIRECT_TIMEOUT = 1000

export default function Redir() {
  const params = useParams<{ uri?: string }>()

  invariant(params.uri, '`uri` must be defined')

  const classes = useStyles()

  const decoded = decodeURIComponent(params.uri)
  const uri = React.useMemo(() => UriResolver.parsePackageUriSafe(decoded), [decoded])

  const [redirecting, setRedirecting] = React.useState<PackageUri.PackageUri | null>(null)
  React.useEffect(() => {
    if (isError(uri)) return

    window.location.assign(decoded)

    const timeoutId = setTimeout(() => setRedirecting(uri), REDIRECT_TIMEOUT)
    return () => clearTimeout(timeoutId)
  }, [decoded, uri])

  if (redirecting) return <UriResolver.Redirect parsed={redirecting} decoded={decoded} />

  return (
    <Layout>
      <MetaTitle>Resolve a Quilt+ URI</MetaTitle>
      {isError(uri) ? (
        <Empty
          className={classes.root}
          primary={<OpenInDesktop href="quilt+s3://" />}
          secondary="FIXME"
          title="Failed to redirect"
        >
          <M.Typography color="error">
            Error parsing URI: {uri.msg || `${uri}`}
          </M.Typography>
        </Empty>
      ) : (
        <Empty
          className={classes.root}
          primary={<OpenInDesktop href={PackageUri.stringify(uri)} />}
          secondary="Click the button if you’re not redirected automatically."
          title="Redirecting…"
        />
      )}
    </Layout>
  )
}
