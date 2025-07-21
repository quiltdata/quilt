import invariant from 'invariant'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Empty from 'components/Empty'
import Layout from 'components/Layout'
import * as UriResolver from 'containers/UriResolver'
import MetaTitle from 'utils/MetaTitle'
import * as PackageUri from 'utils/PackageUri'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(6, 0),
  },
}))

interface WaitingScreenProps {
  uri: PackageUri.PackageUri | PackageUri.PackageUriError
}

// FIXME
// Two different states for waiting valid uri,
// and for showing that redirect failed because uri is invalid
function WaitingScreen({ uri }: WaitingScreenProps) {
  const classes = useStyles()

  return (
    <Layout
      pre={
        <>
          <MetaTitle>Resolve a Quilt+ URI</MetaTitle>

          <Empty
            className={classes.root}
            title={uri instanceof Error ? 'Failed to redirect' : 'Redirecting…'}
            description={
              <>
                <M.Button
                  color="primary"
                  component="a"
                  href={uri instanceof Error ? 'quilt+s3://' : PackageUri.stringify(uri)}
                  variant="contained"
                >
                  Open QuiltSync
                </M.Button>

                <M.Typography>
                  Click the button if you’re not redirected automatically.
                </M.Typography>
              </>
            }
          >
            {uri instanceof Error && (
              <M.Typography color="error">
                Error parsing URI: {uri.msg || `${uri}`}
              </M.Typography>
            )}
          </Empty>
        </>
      }
    />
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

  const decoded = decodeURIComponent(params.uri || '')
  const uri = useUriResolver(decoded)

  const [opened, setOpened] = React.useState(false)
  React.useEffect(() => {
    if (uri instanceof Error) return
    window.location.assign(decoded)
    setTimeout(() => {
      setOpened(true)
    }, 3000)
  }, [decoded, uri])

  if (!opened || uri instanceof Error) {
    return <Layout pre={<WaitingScreen uri={uri} />} />
  }

  return <UriResolver.Redirect parsed={uri} decoded={decoded} />
}
