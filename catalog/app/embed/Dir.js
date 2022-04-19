import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import { copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'

import Code from 'containers/Bucket/Code'
import * as FileView from 'containers/Bucket/FileView'
import { Listing, PrefixFilter } from 'containers/Bucket/Listing'
import Summary from 'containers/Bucket/Summary'
import { displayError } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

import * as EmbedConfig from './EmbedConfig'
import getCrumbs from './getCrumbs'

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
  const cfg = EmbedConfig.use()
  const { noDownload } = Config.use()
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const s3 = AWS.S3.use()
  const { prefix } = parseSearch(l.search)
  const path = s3paths.decode(encodedPath)
  const dest = path ? basename(path) : bucket

  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: dedent`
          import quilt3 as q3
          b = q3.Bucket("s3://${bucket}")
          # list files
          b.ls("${path}")
          # download
          b.fetch("${path}", "./${dest}")
        `,
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: dedent`
          # list files
          aws s3 ls "s3://${bucket}/${path}"
          # download
          aws s3 cp --recursive "s3://${bucket}/${path}" "./${dest}"
        `,
      },
    ],
    [bucket, path, dest],
  )

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

  return (
    <M.Box pt={2} pb={4}>
      <M.Box display="flex" alignItems="flex-start" mb={2}>
        <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
          {renderCrumbs(getCrumbs({ bucket, path, urls, scope: cfg.scope }))}
        </div>
        <M.Box flexGrow={1} />
        {!noDownload && (
          <FileView.ZipDownloadForm
            suffix={`dir/${bucket}/${path}`}
            label="Download directory"
            newTab
          />
        )}
      </M.Box>

      {!cfg.hideCode && <Code gutterBottom>{code}</Code>}

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x) => {
          const res = AsyncResult.getPrevResult(x)

          if (!res) return <M.CircularProgress />

          const items = formatListing({ urls, scope: cfg.scope }, res)

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
              <Summary files={res.files} />
            </>
          )
        },
      })}
    </M.Box>
  )
}
