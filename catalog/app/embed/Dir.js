import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import cfg from 'constants/config'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'

import DirCodeSamples from 'containers/Bucket/CodeSamples/Dir'
import * as FileView from 'containers/Bucket/FileView'
import { Listing, PrefixFilter } from 'containers/Bucket/Listing'
import Summary from 'containers/Bucket/Summary'
import { displayError } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

import * as EmbedConfig from './EmbedConfig'

const formatListing = ({ urls, scope }, r) => {
  const dirs = r.dirs.map((name) => ({
    type: 'dir',
    name: s3paths.ensureNoSlash(s3paths.withoutPrefix(r.path, name)),
    to: urls.bucketDir(r.bucket, name),
  }))
  const files = r.files.map(({ key, size, modified, archived }) => ({
    type: 'file',
    name: basename(key),
    to: urls.bucketFile(r.bucket, key),
    size,
    modified,
    archived,
  }))
  const items = [...dirs, ...files]
  if (r.path !== '' && r.path !== scope && !r.prefix) {
    items.unshift({
      type: 'dir',
      name: '..',
      to: urls.bucketDir(r.bucket, s3paths.up(r.path)),
    })
  }
  // filter-out files with same name as one of dirs
  return R.uniqBy(R.prop('name'), items)
}

const useStyles = M.makeStyles((t) => ({
  crumbs: {
    ...t.typography.body1,
    maxWidth: '100%',
    overflowWrap: 'break-word',
  },
}))

export default function Dir({
  match: {
    params: { bucket, path: encodedPath = '' },
  },
  location: l,
}) {
  const ecfg = EmbedConfig.use()
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const s3 = AWS.S3.use()
  const { prefix } = parseSearch(l.search)
  const path = s3paths.decode(encodedPath)

  const [prev, setPrev] = React.useState(null)

  React.useLayoutEffect(() => {
    // reset accumulated results when path and/or prefix change
    setPrev(null)
  }, [path, prefix])

  const data = useData(requests.bucketListing, {
    s3,
    bucket,
    path,
    prefix,
    prev,
  })

  const loadMore = React.useCallback(() => {
    AsyncResult.case(
      {
        Ok: (res) => {
          // this triggers a re-render and fetching of next page of results
          if (res.continuationToken) setPrev(res)
        },
        _: () => {},
      },
      data.result,
    )
  }, [data.result, setPrev])

  const setPrefix = React.useCallback(
    (newPrefix) => {
      history.push(urls.bucketDir(bucket, path, newPrefix))
    },
    [history, urls, bucket, path],
  )

  const scoped = ecfg.scope && path.startsWith(ecfg.scope)
  const scopedPath = scoped ? path.substring(ecfg.scope.length) : path
  const getSegmentRoute = React.useCallback(
    (segPath) => urls.bucketDir(bucket, `${scoped ? ecfg.scope : ''}${segPath}`),
    [bucket, ecfg.scope, scoped, urls],
  )
  const crumbs = BreadCrumbs.use(
    scopedPath,
    getSegmentRoute,
    scoped ? basename(ecfg.scope) : 'ROOT',
  )

  return (
    <M.Box pt={2} pb={4}>
      <M.Box display="flex" alignItems="flex-start" mb={2}>
        <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
          {BreadCrumbs.render(crumbs)}
        </div>
        <M.Box flexGrow={1} />
        {!cfg.noDownload && (
          <FileView.ZipDownloadForm
            suffix={`dir/${bucket}/${path}`}
            label="Download directory"
            newTab
          />
        )}
      </M.Box>

      {!ecfg.hideCode && (
        <DirCodeSamples bucket={bucket} path={path} gutterBottom />
      )}

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x) => {
          const res = AsyncResult.getPrevResult(x)

          if (!res) return <M.CircularProgress />

          const items = formatListing({ urls, scope: ecfg.scope }, res)

          const locked = !AsyncResult.Ok.is(x)

          return (
            <>
              <Listing
                items={items}
                locked={locked}
                loadMore={loadMore}
                truncated={res.truncated}
                prefixFilter={res.prefix}
                toolbarContents={
                  <PrefixFilter
                    key={`${res.bucket}/${res.path}`}
                    prefix={res.prefix}
                    setPrefix={setPrefix}
                  />
                }
              />
              <Summary files={res.files} path={path} />
            </>
          )
        },
      })}
    </M.Box>
  )
}
