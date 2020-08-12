import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { useBucketCache } from 'containers/Bucket'

import { Route, Switch, useHistory, useLocation } from 'react-router-dom'

import * as Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { ThrowNotFound, createNotFound } from 'containers/NotFoundPage'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

// TODO: consider reimplementing these locally or moving to some shared location
import { displayError } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

const mkLazy = (load) =>
  RT.loadable(load, { fallback: () => <Placeholder color="text.secondary" /> })

const Dir = mkLazy(() => import('./Dir'))
const File = mkLazy(() => import('./File'))

function NotFound() {
  // TODO: style
  return (
    <Layout.Root>
      <M.Box p={4}>
        <M.Typography>Not found</M.Typography>
      </M.Box>
    </Layout.Root>
  )
}

const CatchNotFound = createNotFound(NotFound)

function Root() {
  const l = useLocation()
  console.log('Root', l)
  const { paths } = NamedRoutes.use()
  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <Route path={paths.bucketRoot} component={Bucket} />
        <Route component={ThrowNotFound} />
      </Switch>
    </CatchNotFound>
  )
}

function Bucket({ match: { params: { bucket } } }) {
  console.log('Bucket', bucket)
  const { paths } = NamedRoutes.use()
  const l = useLocation()

  return (
    <BucketLayout bucket={bucket}>
      <Switch>
        <Route path={paths.bucketFile} component={File} exact strict />
        <Route path={paths.bucketDir} component={Dir} exact />
        <Route component={ThrowNotFound} />
      </Switch>
    </BucketLayout>
  )
}

function BucketLayout({ bucket, children }) {
  const s3 = AWS.S3.use()
  const cache = useBucketCache()
  const data = useData(requests.bucketExists, { s3, bucket, cache })
  return (
    <Layout.Root>
      <M.Box p={4}>
        {data.case({
          Ok: () => children,
          Err: displayError(),
          _: () => <Placeholder color="text.secondary" />,
        })}
      </M.Box>
      <M.Box flexGrow={1} />
    </Layout.Root>
  )
}

function useInit() {
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  const [state, setState] = React.useState(null)

  const handleMessage = React.useCallback(({ data }) => {
    if (!data || data.type !== 'init') return
    const { bucket, path } = data
    console.log('init', data)
    // TODO: receive tokens
    history.replace(urls.bucketDir(bucket, path))
    setState(true)
  }, [setState, history, urls])

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])

  return state
}

export default function HeadlessFileBrowser() {
  const init = useInit()
  return init ? <Root /> : <Placeholder color="text.secondary" />
}
