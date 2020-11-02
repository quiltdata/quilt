import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import { getBreadCrumbs, ensureNoSlash, withoutPrefix, up, decode } from 'utils/s3paths'

import Code from './Code'
import { ListingItem, ListingWithPrefixFiltering } from './Listing'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const getCrumbs = R.compose(
  R.intersperse(Crumb.Sep(<>&nbsp;/ </>)),
  ({ bucket, path, urls }) =>
    [{ label: bucket, path: '' }, ...getBreadCrumbs(path)].map(
      ({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to: segPath === path ? undefined : urls.bucketDir(bucket, segPath),
        }),
    ),
)

const formatListing = ({ urls }, r) => {
  const dirs = r.dirs.map((name) =>
    ListingItem.Dir({
      name: ensureNoSlash(withoutPrefix(r.path, name)),
      to: urls.bucketDir(r.bucket, name),
    }),
  )
  const files = r.files.map(({ key, size, modified, archived }) =>
    ListingItem.File({
      name: basename(key),
      to: urls.bucketFile(r.bucket, key),
      size,
      modified,
      archived,
    }),
  )
  const items = [
    ...(r.path !== '' && !r.prefix
      ? [
          ListingItem.Dir({
            name: '..',
            to: urls.bucketDir(r.bucket, up(r.path)),
          }),
        ]
      : []),
    ...dirs,
    ...files,
  ]
  // filter-out files with same name as one of dirs
  return R.uniqBy(ListingItem.case({ Dir: R.prop('name'), File: R.prop('name') }), items)
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
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const s3 = AWS.S3.use()
  const { prefix } = parseSearch(l.search)
  const path = decode(encodedPath)
  const dest = path ? basename(path) : bucket

  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: dedent`
          import quilt3
          b = quilt3.Bucket("s3://${bucket}")
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

  const data = useData(requests.bucketListing, {
    s3,
    bucket,
    path,
    prefix,
  })

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
          {renderCrumbs(getCrumbs({ bucket, path, urls }))}
        </div>
        <M.Box flexGrow={1} />
      </M.Box>

      <Code gutterBottom>{code}</Code>

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x) => {
          const res = AsyncResult.case(
            {
              Ok: R.identity,
              Pending: AsyncResult.case({
                Ok: R.identity,
                _: () => null,
              }),
              _: () => null,
            },
            x,
          )

          if (!res) return <M.CircularProgress />

          const items = formatListing({ urls }, res)

          const locked = !AsyncResult.Ok.is(x)

          // TODO: should prefix filtering affect summary?
          return (
            <>
              <ListingWithPrefixFiltering
                items={items}
                locked={locked}
                truncated={res.truncated}
                prefix={res.prefix}
                setPrefix={setPrefix}
                bucket={res.bucket}
                path={res.path}
              />
              <Summary files={res.files} />
            </>
          )
        },
      })}
    </M.Box>
  )
}
