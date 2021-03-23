import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import parseSearch from 'utils/parseSearch'
import { getBreadCrumbs, ensureNoSlash, withoutPrefix, up, decode } from 'utils/s3paths'

import Code from './Code'
import CopyButton from './CopyButton'
import * as FileView from './FileView'
import { Listing, PrefixFilter } from './Listing'
import PackageDirectoryDialog from './PackageDirectoryDialog'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

interface RouteMap {
  bucketDir: [bucket: string, path?: string, prefix?: string]
  bucketFile: [bucket: string, path: string, version?: string]
}

type Urls = NamedRoutes.Urls<RouteMap>

interface ListingFile {
  bucket: string
  key: string
  modified: Date
  size: number
  etag: string
  archived: boolean
}

interface ListingResponse {
  dirs: string[]
  files: ListingFile[]
  truncated: boolean
  bucket: string
  path: string
  prefix: string
}

const getCrumbs = R.compose(
  R.intersperse(Crumb.Sep(<>&nbsp;/ </>)),
  ({ bucket, path, urls }: { bucket: string; path: string; urls: Urls }) =>
    [{ label: bucket, path: '' }, ...getBreadCrumbs(path)].map(
      ({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to: segPath === path ? undefined : urls.bucketDir(bucket, segPath),
        }),
    ),
)

const formatListing = ({ urls }: { urls: Urls }, r: ListingResponse) => {
  const dirs = r.dirs.map((name) => ({
    type: 'dir' as const,
    name: ensureNoSlash(withoutPrefix(r.path, name)),
    to: urls.bucketDir(r.bucket, name),
  }))
  const files = r.files.map(({ key, size, modified, archived }) => ({
    type: 'file' as const,
    name: withoutPrefix(r.path, key),
    to: urls.bucketFile(r.bucket, key),
    size,
    modified,
    archived,
  }))
  const items = [
    ...(r.path !== '' && !r.prefix
      ? [
          {
            type: 'dir' as const,
            name: '..',
            to: urls.bucketDir(r.bucket, up(r.path)),
          },
        ]
      : []),
    ...dirs,
    ...files,
  ]
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

interface DirParams {
  bucket: string
  path?: string
}

export default function Dir({
  match: {
    params: { bucket, path: encodedPath = '' },
  },
  location: l,
}: RRDom.RouteComponentProps<DirParams>) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use<RouteMap>()
  const { noDownload } = Config.use()
  const history = RRDom.useHistory()
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

  const [successor, setSuccessor] = React.useState(null)

  const onPackageDirectoryDialogExited = React.useCallback(() => {
    setSuccessor(null)
  }, [setSuccessor])

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

  const preferences = BucketPreferences.use()

  return (
    <M.Box pt={2} pb={4}>
      <M.Box display="flex" alignItems="flex-start" mb={2}>
        <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
          {renderCrumbs(getCrumbs({ bucket, path, urls }))}
        </div>
        <M.Box flexGrow={1} />
        {preferences?.ui?.actions?.createPackage && (
          <CopyButton bucket={bucket} onChange={setSuccessor}>
            Create package from directory
          </CopyButton>
        )}
        {!noDownload && (
          <>
            <M.Box ml={1} />
            <FileView.ZipDownloadForm
              suffix={`dir/${bucket}/${path}`}
              label="Download directory"
            />
          </>
        )}
      </M.Box>

      <Code gutterBottom>{code}</Code>

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x: $TSFixMe) => {
          const res: ListingResponse | null = AsyncResult.case(
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

          // TODO: memoize
          const items = formatListing({ urls }, res)

          const locked = !AsyncResult.Ok.is(x)

          // TODO: should prefix filtering affect summary?
          return (
            <>
              <PackageDirectoryDialog
                bucket={bucket}
                path={path}
                files={res.files}
                dirs={res.dirs}
                truncated={res.truncated}
                open={!!successor}
                successor={successor}
                onExited={onPackageDirectoryDialogExited}
              />

              <Listing
                items={items}
                locked={locked}
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
              {/* @ts-expect-error */}
              <Summary files={res.files} />
            </>
          )
        },
      })}
    </M.Box>
  )
}
