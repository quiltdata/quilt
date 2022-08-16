import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import type * as DG from 'components/DataGrid'
import * as Bookmarks from 'containers/Bookmarks'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import parseSearch from 'utils/parseSearch'
import {
  S3HandleBase,
  decode,
  ensureNoSlash,
  ensureSlash,
  getBreadCrumbs,
  up,
  withoutPrefix,
} from 'utils/s3paths'
import type * as workflows from 'utils/workflows'

import Code from './Code'
import * as FileView from './FileView'
import { Item, Listing, PrefixFilter } from './Listing'
import * as PD from './PackageDialog'
import * as Successors from './Successors'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    justifyContent: 'center',
    padding: t.spacing(0.5, 0),
  },
  button: {
    fontSize: 11,
    lineHeight: '22px',
    margin: t.spacing(0, 1),
  },
  count: {
    marginRight: t.spacing(1),
  },
  wrapper: {
    width: '100%',
  },
}))

interface HeaderProps {
  items: Item[]
  onClearSelection: () => void
  selection?: DG.GridRowId[]
}

function Header({ items, onClearSelection, selection }: HeaderProps) {
  const classes = useHeaderStyles()
  const count = selection?.length || 0
  const bookmarks = Bookmarks.use()
  const bookmarkItems: S3HandleBase[] = React.useMemo(() => {
    const handles: S3HandleBase[] = []
    items.some(({ name, handle, type }) => {
      if (!selection?.length) return true
      if (selection?.includes(name) && handle)
        handles.push({
          ...handle,
          key: type === 'dir' ? ensureSlash(handle.key) : handle.key,
        })
      if (handles.length === selection?.length) return true
      return false
    })
    return handles
  }, [items, selection])
  const handleClick = React.useCallback(() => {
    bookmarkItems?.forEach((handle) => {
      bookmarks?.append('bookmarks', handle)
    })
    onClearSelection()
  }, [bookmarks, bookmarkItems, onClearSelection])
  return (
    <M.Collapse in={!!count} className={classes.wrapper} timeout={100}>
      <div className={classes.root}>
        <M.Typography className={classes.count} variant="body2">
          {count > 1 ? `${count} items are selected` : `${count} item is selected`}
        </M.Typography>
        <M.Button
          className={classes.button}
          color="primary"
          size="small"
          variant="outlined"
          onClick={handleClick}
        >
          Add to bookmarks
        </M.Button>
        or
        <M.Button
          className={classes.button}
          color="primary"
          size="small"
          onClick={onClearSelection}
        >
          Clear selection
        </M.Button>
      </div>
    </M.Collapse>
  )
}

interface RouteMap {
  bucketDir: [bucket: string, path?: string, prefix?: string]
  bucketFile: [bucket: string, path: string, version?: string]
}

type Urls = NamedRoutes.Urls<RouteMap>

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

function useFormattedListing(r: requests.BucketListingResult) {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useMemo(() => {
    const dirs = r.dirs.map((name) => ({
      type: 'dir' as const,
      name: ensureNoSlash(withoutPrefix(r.path, name)),
      to: urls.bucketDir(r.bucket, name),
      handle: {
        bucket: r.bucket,
        key: name,
      },
    }))
    const files = r.files.map(({ key, size, modified, archived }) => ({
      type: 'file' as const,
      name: withoutPrefix(r.path, key),
      to: urls.bucketFile(r.bucket, key),
      size,
      modified,
      archived,
      handle: {
        bucket: r.bucket,
        key,
      },
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
  }, [r, urls])
}

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  bucket: string
  path: string
  loadMore?: () => void
}

function DirContents({ response, locked, bucket, path, loadMore }: DirContentsProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()

  const setPrefix = React.useCallback(
    (newPrefix) => {
      history.push(urls.bucketDir(bucket, path, newPrefix))
    },
    [history, urls, bucket, path],
  )

  const items = useFormattedListing(response)

  const [selection, setSelection] = React.useState([])
  const handleSelectionModelChange = React.useCallback((ids) => setSelection(ids), [])
  React.useEffect(() => setSelection([]), [bucket, path])

  // TODO: should prefix filtering affect summary?
  return (
    <>
      <Listing
        items={items}
        locked={locked}
        loadMore={loadMore}
        truncated={response.truncated}
        prefixFilter={response.prefix}
        onSelectionChange={handleSelectionModelChange}
        selection={selection}
        toolbarContents={
          <>
            <Header
              items={items}
              selection={selection}
              onClearSelection={() => setSelection([])}
            />
            <PrefixFilter
              key={`${response.bucket}/${response.path}`}
              prefix={response.prefix}
              setPrefix={setPrefix}
            />
          </>
        }
      />
      {/* Remove TS workaround when Summary will be converted to .tsx */}
      {/* @ts-expect-error */}
      <Summary files={response.files} mkUrl={null} path={path} />
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  crumbs: {
    ...t.typography.body1,
    maxWidth: '100%',
    overflowWrap: 'break-word',
  },
  button: {
    flexShrink: 0,
    marginBottom: '-3px',
    marginLeft: t.spacing(1),
    marginTop: '-3px',
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
  const { desktop, noDownload } = Config.use()
  const s3 = AWS.S3.use()
  const preferences = BucketPreferences.use()
  const { prefix } = parseSearch(l.search)
  const path = decode(encodedPath)
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

  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)

  React.useLayoutEffect(() => {
    // reset accumulated results when path and / or prefix change
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
        Ok: (res: requests.BucketListingResult) => {
          // this triggers a re-render and fetching of next page of results
          if (res.continuationToken) setPrev(res)
        },
        _: () => {},
      },
      data.result,
    )
  }, [data.result])

  const packageDirectoryDialog = PD.usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })

  const openPackageCreationDialog = React.useCallback(
    (successor: workflows.Successor) => {
      packageDirectoryDialog.open({
        path,
        successor,
      })
    },
    [packageDirectoryDialog, path],
  )

  return (
    <M.Box pt={2} pb={4}>
      <MetaTitle>{[path || 'Files', bucket]}</MetaTitle>

      {packageDirectoryDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package from directory',
      })}

      <M.Box display="flex" alignItems="flex-start" mb={2}>
        <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
          {renderCrumbs(getCrumbs({ bucket, path, urls }))}
        </div>
        <M.Box flexGrow={1} />
        {preferences?.ui?.actions?.createPackage && (
          <Successors.Button
            bucket={bucket}
            className={classes.button}
            onChange={openPackageCreationDialog}
          >
            Create package from directory
          </Successors.Button>
        )}
        {!noDownload && !desktop && (
          <FileView.ZipDownloadForm
            className={classes.button}
            suffix={`dir/${bucket}/${path}`}
            label="Download directory"
          />
        )}
      </M.Box>

      {preferences?.ui?.blocks?.code && <Code gutterBottom>{code}</Code>}

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x: $TSFixMe) => {
          const res: requests.BucketListingResult | null = AsyncResult.getPrevResult(x)
          return res ? (
            <DirContents
              response={res}
              locked={!AsyncResult.Ok.is(x)}
              bucket={bucket}
              path={path}
              loadMore={loadMore}
            />
          ) : (
            <M.CircularProgress />
          )
        },
      })}
    </M.Box>
  )
}
