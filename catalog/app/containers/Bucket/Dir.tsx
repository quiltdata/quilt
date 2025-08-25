import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import type * as Routes from 'constants/routes'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as Dialogs from 'utils/Dialogs'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'

import * as AssistantContext from './DirAssistantContext'
import DndWrapper from './DndWrapper'
import * as Listing from './Listing'
import * as FI from './PackageDialog/FilesInput'
import * as Selection from './Selection'
import Summary from './Summary'
import * as Toolbar from './Toolbar'
import { displayError } from './errors'
import * as requests from './requests'

interface RouteMap {
  bucketDir: Routes.BucketDirArgs
  bucketFile: Routes.BucketFileArgs
}

function useFormattedListing(r: requests.BucketListingResult): Listing.Item[] {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useMemo(() => {
    const d = r.dirs.map((p) => Listing.Entry.Dir({ key: p }))
    const f = r.files.map(Listing.Entry.File)
    return Listing.format([...d, ...f], { bucket: r.bucket, prefix: r.path, urls })
  }, [r, urls])
}

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  bucket: string
  path: string
  loadMore?: () => void
  selection: Selection.SelectionItem[]
  onSelection: (ids: Selection.SelectionItem[]) => void
  onReload: () => void
}

function DirContents({
  response,
  locked,
  bucket,
  path,
  loadMore,
  selection,
  onSelection,
  onReload,
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

  const dialogs = Dialogs.use()
  const dirHandle = React.useMemo(
    () => Toolbar.DirHandleCreate(bucket, path),
    [bucket, path],
  )

  const handleDrop = React.useCallback(
    (files: FI.LocalFile[]) => {
      const added = files.reduce(
        (memo, file) => ({
          ...memo,
          [s3paths.withoutPrefix('/', file.path || file.name)]: file,
        }),
        {},
      )
      dialogs.open(({ close }) => (
        <Toolbar.Add.UploadDialog
          handle={dirHandle}
          initial={added}
          onClose={(reason) => {
            close()
            if (reason === 'upload-success') {
              onReload()
            }
          }}
        />
      ))
    },
    [dialogs, dirHandle, onReload],
  )

  // TODO: should prefix filtering affect summary?
  return (
    <>
      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}

      <DndWrapper handle={dirHandle} disabled={locked} onDrop={handleDrop}>
        <Listing.Listing
          items={items}
          locked={locked}
          loadMore={loadMore}
          truncated={response.truncated}
          prefixFilter={response.prefix}
          onSelectionChange={onSelection}
          selection={selection}
          onReload={onReload}
          toolbarContents={
            <Listing.PrefixFilter
              key={`${response.bucket}/${response.path}`}
              prefix={response.prefix}
              setPrefix={setPrefix}
            />
          }
        />
      </DndWrapper>
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
  topbar: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: t.spacing(2),
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  actions: {
    display: 'flex',
    flexShrink: 0,
    margin: '-3px 0 -3px auto',
    [t.breakpoints.down('sm')]: {
      marginTop: t.spacing(0.5),
    },
  },
  tooltip: {
    padding: t.spacing(0, 1),
  },
}))

interface DirParams {
  bucket: string
  path?: string
}

export default function Dir() {
  const { bucket, path: encodedPath = '' } = RRDom.useParams<DirParams>()
  const l = RRDom.useLocation()
  invariant(!!bucket, '`bucket` must be defined')

  const classes = useStyles()
  const s3 = AWS.S3.use()
  const { prefix } = parseSearch(l.search, true)
  const path = s3paths.decode(encodedPath)

  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)

  React.useLayoutEffect(() => {
    // reset accumulated results when path and / or prefix change
    setPrev(null)
  }, [path, prefix])

  const [key, setKey] = React.useState(0)
  const handleReload = React.useCallback(() => setKey((c) => c + 1), [])
  const data = useData(requests.bucketListing, {
    s3,
    bucket,
    path,
    prefix,
    prev,
    key,
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

  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within a Selection.Provider')
  const handleSelection = React.useCallback(
    (ids) => slt.merge(ids, bucket, path, prefix),
    [bucket, path, prefix, slt],
  )

  const { paths, urls } = NamedRoutes.use<RouteMap>()
  const getSegmentRoute = React.useCallback(
    (segPath: string) => urls.bucketDir(bucket, segPath),
    [bucket, urls],
  )
  const crumbs = BreadCrumbs.use(path, getSegmentRoute, bucket)

  const guardNavigation = React.useCallback(
    (location) => {
      if (
        !RRDom.matchPath(location.pathname, {
          path: paths.bucketDir,
          exact: true,
        })
      ) {
        return 'Selection will be lost. Clear selection and confirm navigation?'
      }
      return true
    },
    [paths],
  )

  const dirHandle = React.useMemo(
    () => Toolbar.DirHandleCreate(bucket, path),
    [bucket, path],
  )
  const toolbarFeatures = Toolbar.useBucketDirFeatures()

  return (
    <M.Box pt={2} pb={4}>
      <MetaTitle>{[path || 'Files', bucket]}</MetaTitle>

      <AssistantContext.ListingContext data={data} />

      <RRDom.Prompt when={!slt.isEmpty} message={guardNavigation} />

      <div className={classes.topbar}>
        <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
          {BreadCrumbs.render(crumbs)}
        </div>
        <Toolbar.BucketDir
          className={classes.actions}
          features={toolbarFeatures}
          handle={dirHandle}
          onReload={handleReload}
        />
      </div>

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
              selection={Selection.getDirectorySelection(
                slt.selection,
                res.bucket,
                res.path,
              )}
              onSelection={handleSelection}
              onReload={handleReload}
            />
          ) : (
            <M.CircularProgress />
          )
        },
      })}
    </M.Box>
  )
}
