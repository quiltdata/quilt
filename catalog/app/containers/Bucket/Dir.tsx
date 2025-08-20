import invariant from 'invariant'
import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import cfg from 'constants/config'
import type * as Routes from 'constants/routes'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import type * as workflows from 'utils/workflows'

import * as Download from './Download'
import * as AssistantContext from './DirAssistantContext'
import * as Listing from './Listing'
import Menu from './Menu'
import * as PD from './PackageDialog'
import * as Selection from './Selection'
import * as Successors from './Successors'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

interface DirectoryMenuProps {
  bucket: string
  className?: string
  path: string
}

function DirectoryMenu({ bucket, path, className }: DirectoryMenuProps) {
  const { prefs } = BucketPreferences.use()
  const prompt = FileEditor.useCreateFileInBucket(bucket, path)
  const menuItems = React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions } }) => {
            const menu = []
            if (actions.writeFile) {
              menu.push({
                onClick: prompt.open,
                title: 'Create file',
              })
            }
            return menu
          },
          _: () => [],
        },
        prefs,
      ),
    [prefs, prompt.open],
  )
  if (!menuItems.length) return null
  return (
    <>
      {prompt.render()}
      <Menu className={className} items={menuItems} />
    </>
  )
}

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
      <Listing.Listing
        items={items}
        locked={locked}
        loadMore={loadMore}
        truncated={response.truncated}
        prefixFilter={response.prefix}
        onSelectionChange={onSelection}
        selection={selection}
        toolbarContents={
          <>
            <Listing.PrefixFilter
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
  const { prefs } = BucketPreferences.use()
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

  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within a Selection.Provider')
  const handleSelection = React.useCallback(
    (ids) => slt.merge(ids, bucket, path, prefix),
    [bucket, path, prefix, slt],
  )

  const packageDirectoryDialog = PD.usePackageCreationDialog({
    s3Path: path,
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })

  const openPackageCreationDialog = React.useCallback(
    (successor: workflows.Successor) => {
      packageDirectoryDialog.open({
        path,
        successor,
        selection: slt.selection,
      })
    },
    [packageDirectoryDialog, path, slt.selection],
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

  const dirHandle = React.useMemo(() => ({ bucket, path }), [bucket, path])

  return (
    <M.Box pt={2} pb={4}>
      <MetaTitle>{[path || 'Files', bucket]}</MetaTitle>

      <AssistantContext.ListingContext data={data} />

      <RRDom.Prompt when={!slt.isEmpty} message={guardNavigation} />

      {packageDirectoryDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}

      <div className={classes.topbar}>
        <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
          {BreadCrumbs.render(crumbs)}
        </div>
        <div className={classes.actions}>
          <Selection.Control className={cx(classes.button)} />
          {BucketPreferences.Result.match(
            {
              Ok: ({ ui: { actions, blocks } }) => (
                <>
                  {actions.createPackage && (
                    <Successors.Button
                      bucket={bucket}
                      className={classes.button}
                      onChange={openPackageCreationDialog}
                      variant={slt.isEmpty ? 'outlined' : 'contained'}
                      color={slt.isEmpty ? 'default' : 'primary'}
                    >
                      Create package
                    </Successors.Button>
                  )}
                  {!cfg.noDownload && actions.downloadObject && (
                    <Download.Button className={classes.button}>
                      <Download.BucketOptions
                        handle={dirHandle}
                        hideCode={!blocks.code}
                      />
                    </Download.Button>
                  )}
                </>
              ),
              Pending: () => (
                <>
                  <Buttons.Skeleton className={classes.button} size="small" />
                  <Buttons.Skeleton className={classes.button} size="small" />
                </>
              ),
              Init: () => null,
            },
            prefs,
          )}
          <DirectoryMenu className={classes.button} bucket={bucket} path={path} />
        </div>
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
            />
          ) : (
            <M.CircularProgress />
          )
        },
      })}
    </M.Box>
  )
}
