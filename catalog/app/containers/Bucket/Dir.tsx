import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import cfg from 'constants/config'
import type * as Routes from 'constants/routes'
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

import DirCodeSamples from './CodeSamples/Dir'
import * as FileView from './FileView'
import * as Listing from './Listing'
import Menu from './Menu'
import * as PD from './PackageDialog'
import * as Selection from './Selection'
import * as Successors from './Successors'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

interface DirectoryMenuProps {
  location: Model.S3.S3ObjectLocation
  className?: string
}

function DirectoryMenu({ location, className }: DirectoryMenuProps) {
  const prompt = FileEditor.useCreateFileInBucket(location)
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
  bucketDir: Routes.BucketDirArgs
  bucketFile: Routes.BucketFileArgs
}

function useFormattedListing(r: requests.BucketListingResult): Listing.Item[] {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useMemo(() => {
    const { bucket, key: prefix } = r.location
    const d = r.dirs.map((p) => Listing.Entry.Dir({ location: { bucket, key: p } }))
    const f = r.files.map(Listing.Entry.File)
    return Listing.format([...d, ...f], {
      bucket,
      prefix,
      urls,
    })
  }, [r, urls])
}

interface DirContentsProps {
  response: requests.BucketListingResult
  locked: boolean
  location: Model.S3.S3ObjectLocation
  loadMore?: () => void
  selection: string[]
  onSelection: (ids: string[]) => void
}

function DirContents({
  location, // TODO: use response.location?
  response,
  locked,
  loadMore,
  selection,
  onSelection,
}: DirContentsProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()

  const setPrefix = React.useCallback(
    (newPrefix) => history.push(urls.bucketDir(location, newPrefix)),
    [history, location, urls],
  )

  const items = useFormattedListing(response)
  const summaryLocations = React.useMemo(
    () => response.files.map((f) => f.location),
    [response.files],
  )

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
              key={`${response.location.bucket}/${response.location.key}`}
              prefix={response.prefix}
              setPrefix={setPrefix}
            />
          </>
        }
      />
      {/* Remove TS workaround when Summary will be converted to .tsx */}
      {/* @ts-expect-error */}
      <Summary files={summaryLocations} mkUrl={null} />
    </>
  )
}

const useSelectionWidgetStyles = M.makeStyles({
  close: {
    marginLeft: 'auto',
  },
  title: {
    alignItems: 'center',
    display: 'flex',
  },
  badge: {
    right: '4px',
  },
})

interface SelectionWidgetProps {
  className: string
  selection: Selection.PrefixedKeysMap
  onSelection: (changed: Selection.PrefixedKeysMap) => void
}

function SelectionWidget({ className, selection, onSelection }: SelectionWidgetProps) {
  const classes = useSelectionWidgetStyles()
  const location = RRDom.useLocation()
  const count = Object.values(selection).reduce((memo, ids) => memo + ids.length, 0)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])
  React.useEffect(() => close(), [close, location])
  const badgeClasses = React.useMemo(() => ({ badge: classes.badge }), [classes])
  return (
    <>
      <M.Badge
        badgeContent={count}
        classes={badgeClasses}
        className={className}
        color="primary"
        max={999}
        showZero
      >
        <M.Button onClick={open} size="small">
          Selected items
        </M.Button>
      </M.Badge>

      <M.Dialog open={opened} onClose={close} fullWidth maxWidth="md">
        <M.DialogTitle disableTypography>
          <M.Typography className={classes.title} variant="h6">
            {count} items selected
            <M.IconButton size="small" className={classes.close} onClick={close}>
              <M.Icon>close</M.Icon>
            </M.IconButton>
          </M.Typography>
        </M.DialogTitle>
        <M.DialogContent>
          <Selection.Dashboard
            onSelection={onSelection}
            onDone={close}
            selection={selection}
          />
        </M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={close} variant="contained" color="primary" size="small">
            Close
          </M.Button>
        </M.DialogActions>
      </M.Dialog>
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
  const location = React.useMemo(
    () => ({
      bucket,
      key: s3paths.decode(encodedPath),
    }),
    [bucket, encodedPath],
  )

  const [prev, setPrev] = React.useState<requests.BucketListingResult | null>(null)

  React.useLayoutEffect(() => {
    // reset accumulated results when path and / or prefix change
    setPrev(null)
  }, [location, prefix])

  const data = useData(requests.bucketListing, {
    s3,
    location,
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

  const [selection, setSelection] = React.useState<Record<string, string[]>>(
    Selection.EMPTY_MAP,
  )
  const handleSelection = React.useCallback(
    (ids) => setSelection(Selection.merge(ids, location, prefix)),
    [location, prefix],
  )

  const packageDirectoryDialog = PD.usePackageCreationDialog({
    s3Path: location.key,
    bucket: location.bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })

  const openPackageCreationDialog = React.useCallback(
    (successor: workflows.Successor) => {
      packageDirectoryDialog.open({
        path: location.key,
        successor,
        selection,
      })
    },
    [packageDirectoryDialog, location.key, selection],
  )

  const { paths, urls } = NamedRoutes.use<RouteMap>()
  const getSegmentRoute = React.useCallback(
    (segPath: string) => urls.bucketDir({ bucket: location.bucket, key: segPath }),
    [location.bucket, urls],
  )
  const crumbs = BreadCrumbs.use(location.key, getSegmentRoute, location.bucket)

  const hasSelection = Object.values(selection).some((ids) => !!ids.length)
  const guardNavigation = React.useCallback(
    (loc) => {
      if (
        !RRDom.matchPath(loc.pathname, {
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

  return (
    <M.Box pt={2} pb={4}>
      <MetaTitle>{[location.key || 'Files', location.bucket]}</MetaTitle>

      <RRDom.Prompt when={hasSelection} message={guardNavigation} />

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
          <SelectionWidget
            className={cx(classes.button)}
            selection={selection}
            onSelection={setSelection}
          />
          {BucketPreferences.Result.match(
            {
              Ok: ({ ui: { actions } }) =>
                actions.createPackage && (
                  <Successors.Button
                    bucket={location.bucket}
                    className={classes.button}
                    onChange={openPackageCreationDialog}
                    variant={hasSelection ? 'contained' : 'outlined'}
                    color={hasSelection ? 'primary' : 'default'}
                  >
                    Create package
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
              suffix={`dir/${location.bucket}/${location.key}`}
              label="Download directory"
            />
          )}
          <DirectoryMenu className={classes.button} location={location} />
        </div>
      </div>

      {BucketPreferences.Result.match(
        {
          Ok: ({ ui: { blocks } }) =>
            blocks.code && <DirCodeSamples location={location} gutterBottom />,
          Pending: () => null,
          Init: () => null,
        },
        prefs,
      )}

      {data.case({
        Err: displayError(),
        Init: () => null,
        _: (x: $TSFixMe) => {
          const res: requests.BucketListingResult | null = AsyncResult.getPrevResult(x)
          return res ? (
            <DirContents
              response={res}
              locked={!AsyncResult.Ok.is(x)}
              location={location}
              loadMore={loadMore}
              selection={Selection.getDirectorySelection(selection, res.location)}
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
