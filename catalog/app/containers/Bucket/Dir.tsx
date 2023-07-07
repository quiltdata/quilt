import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import type * as DG from 'components/DataGrid'
import * as FileEditor from 'components/FileEditor'
import cfg from 'constants/config'
import * as Bookmarks from 'containers/Bookmarks'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import type * as workflows from 'utils/workflows'

import { SelectionSection } from './Selection'
import DirCodeSamples from './CodeSamples/Dir'
import * as FileView from './FileView'
import { Listing, PrefixFilter } from './Listing'
import Menu from './Menu'
import * as PD from './PackageDialog'
import * as Successors from './Successors'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const updateDirectorySelection = (bucket: string, path: string, ids: DG.GridRowId[]) =>
  R.assoc(`s3://${bucket}/${path}`, ids)

const mergeWithPrefixed =
  (prefix: string, prefixedIds: DG.GridRowId[]) => (allIds: DG.GridRowId[]) => {
    if (!allIds || !allIds.length) return prefixedIds
    const selectionOutsidePrefixFilter = allIds.filter(
      (id) => !id.toString().startsWith(prefix),
    )
    const newIds = [...selectionOutsidePrefixFilter, ...prefixedIds]
    return R.equals(newIds, allIds) ? allIds : newIds // avoid cyclic update
  }

const updateWithPrefixSelection = (
  bucket: string,
  path: string,
  prefix: string,
  ids: DG.GridRowId[],
) => {
  const lens = R.lensProp<Record<string, DG.GridRowId[]>>(`s3://${bucket}/${path}`)
  return R.over(lens, mergeWithPrefixed(prefix, ids))
}

const updateSelection = (
  bucket: string,
  path: string,
  ids: DG.GridRowId[],
  prefix?: string,
) =>
  prefix
    ? updateWithPrefixSelection(bucket, path, prefix, ids)
    : updateDirectorySelection(bucket, path, ids)

interface DirectoryMenuProps {
  bucket: string
  className?: string
  path: string
}

function DirectoryMenu({ bucket, path, className }: DirectoryMenuProps) {
  const prompt = FileEditor.useCreateFileInBucket(bucket, path)
  const menuItems = React.useMemo(
    () => [
      {
        onClick: prompt.open,
        title: 'Create file',
      },
    ],
    [prompt.open],
  )

  return (
    <>
      {prompt.render()}
      <Menu className={className} items={menuItems} />
    </>
  )
}

interface RouteMap {
  bucketDir: [bucket: string, path?: string, prefix?: string]
  bucketFile: [
    bucket: string,
    path: string,
    options?: {
      add?: boolean
      edit?: boolean
      mode?: string
      next?: string
      version?: string
    },
  ]
}

function useFormattedListing(r: requests.BucketListingResult) {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useMemo(() => {
    const dirs = r.dirs.map((name) => ({
      type: 'dir' as const,
      name: s3paths.ensureNoSlash(s3paths.withoutPrefix(r.path, name)),
      to: urls.bucketDir(r.bucket, name),
      handle: {
        bucket: r.bucket,
        key: name,
      },
    }))
    const files = r.files.map(({ key, size, modified, archived }) => ({
      type: 'file' as const,
      name: s3paths.withoutPrefix(r.path, key),
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
              to: urls.bucketDir(r.bucket, s3paths.up(r.path)),
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
  selection: DG.GridRowId[]
  loadMore?: () => void
  onSelection: (ids: DG.GridRowId[]) => void
}

function DirContents({
  response,
  locked,
  bucket,
  path,
  loadMore,
  selection,
  onSelection,
}: DirContentsProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()

  const setPrefix = React.useCallback(
    (newPrefix) => {
      history.push(urls.bucketDir(bucket, path, newPrefix))
    },
    [history, urls, bucket, path],
  )

  const items = useFormattedListing(response)

  // TODO: should prefix filtering affect summary?
  return (
    <>
      <Listing
        items={items}
        locked={locked}
        loadMore={loadMore}
        truncated={response.truncated}
        prefixFilter={response.prefix}
        onSelectionChange={locked ? undefined : onSelection}
        selection={locked ? undefined : selection}
        toolbarContents={
          <>
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
    marginLeft: t.spacing(1),
  },
  topbar: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: t.spacing(2),
  },
  actions: {
    display: 'flex',
    flexShrink: 0,
    marginBottom: '-3px',
    marginLeft: 'auto',
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
  const s3 = AWS.S3.use()
  const prefs = BucketPreferences.use()
  const { prefix } = parseSearch(l.search, true)
  const path = s3paths.decode(encodedPath)

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

  const [selection, setSelection] = React.useState<Record<string, DG.GridRowId[]>>({})
  const handleSelection = React.useCallback(
    (ids) => {
      setSelection(updateSelection(bucket, path, ids, prefix))
    },
    [bucket, path, prefix],
  )

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
        selection,
      })
    },
    [packageDirectoryDialog, path, selection],
  )

  const { urls } = NamedRoutes.use<RouteMap>()
  const getSegmentRoute = React.useCallback(
    (segPath: string) => urls.bucketDir(bucket, segPath),
    [bucket, urls],
  )
  const crumbs = BreadCrumbs.use(path, getSegmentRoute, bucket)

  const bookmarks = Bookmarks.use()
  const onBookmarks = React.useCallback(
    (handles: Model.S3.S3ObjectLocation[]) => {
      bookmarks?.append('main', handles)
    },
    [bookmarks],
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

      <div className={classes.topbar}>
        <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
          {BreadCrumbs.render(crumbs)}
        </div>
        <div className={classes.actions}>
          {BucketPreferences.Result.match(
            {
              Ok: ({ ui: { actions } }) =>
                actions.createPackage && (
                  <Successors.Button
                    bucket={bucket}
                    className={classes.button}
                    onChange={openPackageCreationDialog}
                  >
                    {`Create package from ${
                      R.isEmpty(selection) ? 'selected entries' : 'directory'
                    }`}
                  </Successors.Button>
                ),
              Pending: () => <Buttons.Skeleton className={classes.button} size="small" />,
              Init: () => null,
            },
            prefs,
          )}
          {!cfg.noDownload && !cfg.desktop && (
            <FileView.ZipDownloadForm
              className={classes.button}
              suffix={`dir/${bucket}/${path}`}
              label="Download directory"
            />
          )}
          <DirectoryMenu className={classes.button} bucket={bucket} path={path} />
        </div>
      </div>

      {BucketPreferences.Result.match(
        {
          Ok: ({ ui: { blocks } }) =>
            blocks.code && <DirCodeSamples bucket={bucket} path={path} gutterBottom />,
          Pending: () => null,
          Init: () => null,
        },
        prefs,
      )}

      <SelectionSection
        bucket={bucket}
        onPackage={openPackageCreationDialog}
        selection={selection}
        onSelection={setSelection}
        onBookmarks={onBookmarks}
      />

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
              selection={selection[`s3://${bucket}/${path}`] || []}
              loadMore={loadMore}
              onSelection={handleSelection}
            />
          ) : (
            <M.CircularProgress />
          )
        },
      })}
    </M.Box>
  )
}
