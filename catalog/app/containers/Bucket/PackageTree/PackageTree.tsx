import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as urql from 'urql'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Assistant from 'components/Assistant'
import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import Message from 'components/Message'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import * as Notifications from 'containers/Notifications'
import cfg from 'constants/config'
import type * as Routes from 'constants/routes'
import * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import Data from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import Log from 'utils/Logging'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as XML from 'utils/XML'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import usePrevious from 'utils/usePrevious'
import * as workflows from 'utils/workflows'

import * as Download from '../Download'
import { FileProperties } from '../FileProperties'
import * as FileView from '../FileView'
import * as Listing from '../Listing'
import * as PD from '../PackageDialog'
import Section from '../Section'
import * as Selection from '../Selection'
import * as Successors from '../Successors'
import Summary from '../Summary'
import AssistButton from '../Toolbar/Assist'
import WithPackagesSupport from '../WithPackagesSupport'
import * as errors from '../errors'
import renderPreview from '../renderPreview'
import * as requests from '../requests'
import { FileType, useViewModes, viewModeToSelectOption } from '../viewModes'

import * as AssistantContext from './AssistantContext'
import PackageLink from './PackageLink'
import RevisionDeleteDialog from './RevisionDeleteDialog'
import RevisionInfo from './RevisionInfo'
import RevisionMenu from './RevisionMenu'

import REVISION_QUERY from './gql/Revision.generated'
import REVISION_LIST_QUERY from './gql/RevisionList.generated'
import DIR_QUERY from './gql/Dir.generated'
import FILE_QUERY from './gql/File.generated'
import DELETE_REVISION from './gql/DeleteRevision.generated'

interface RouteArgs {
  bucket: string
  name: string
  hashOrTag: string
  hash?: string
}

interface PackageRoutes {
  bucketPackageTree: [string, string, string | undefined, string | undefined]
}

const samePackageRoot = (
  urls: NamedRoutes.Urls<PackageRoutes>,
  pathname: string,
  { bucket, name, hashOrTag }: RouteArgs,
) =>
  RRDom.matchPath(pathname, {
    path: urls.bucketPackageTree(bucket, name, hashOrTag, undefined),
    exact: true,
    strict: true,
  })

const samePackageAnyPath = (
  urls: NamedRoutes.Urls<PackageRoutes>,
  pathname: string,
  { bucket, name, hashOrTag }: RouteArgs,
) =>
  RRDom.matchPath(pathname, {
    path: urls.bucketPackageTree(bucket, name, hashOrTag, undefined),
    strict: true,
  })

const sameRevisionAnyPath = (
  urls: NamedRoutes.Urls<PackageRoutes>,
  pathname: string,
  { bucket, name, hash }: RouteArgs,
) =>
  RRDom.matchPath(pathname, {
    path: urls.bucketPackageTree(bucket, name, hash, undefined),
    strict: true,
  })

const isStillBrowsingPackage = (
  urls: NamedRoutes.Urls<PackageRoutes>,
  pathname: string,
  routeArgs: RouteArgs,
) => {
  if (routeArgs.hashOrTag === 'latest') {
    return !!(
      samePackageRoot(urls, pathname, routeArgs) ||
      (samePackageAnyPath(urls, pathname, routeArgs) && s3paths.isDir(pathname))
    )
  } else {
    return !!(sameRevisionAnyPath(urls, pathname, routeArgs) && s3paths.isDir(pathname))
  }
}

const useTopBarStyles = M.makeStyles((t) => ({
  topBar: {
    alignItems: 'flex-end',
    display: 'flex',
    marginBottom: t.spacing(2),
    marginTop: t.spacing(0.5),
  },
  crumbs: {
    ...t.typography.body1,
    maxWidth: 'calc(100% - 160px)',
    overflowWrap: 'break-word',
    [t.breakpoints.down('xs')]: {
      maxWidth: 'calc(100% - 40px)',
    },
  },
  content: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    marginBottom: -3,
    marginLeft: 'auto',
    marginTop: -3,
  },
}))

interface TopBarProps {
  crumbs: BreadCrumbs.Crumb[]
}

function TopBar({ crumbs, children }: React.PropsWithChildren<TopBarProps>) {
  const classes = useTopBarStyles()
  return (
    <div className={classes.topBar}>
      <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
        {BreadCrumbs.render(crumbs)}
      </div>
      <div className={classes.content}>{children}</div>
    </div>
  )
}

function parseFilesQueryString(qs: string) {
  if (!qs) return undefined
  const map = parseSearch(qs, true) as Record<string, string>
  const value = Object.fromEntries(Object.entries(map).filter(([, p]) => !!p))
  return PD.FromPhysicalKeys(value)
}

function useCreateDialog(packageHandle: PackageHandle) {
  const history = RRDom.useHistory()
  const { paths, urls } = NamedRoutes.use<RouteMap>()

  const match = !!RRDom.useRouteMatch({ path: paths.bucketPackageAddFiles, exact: true })

  const { push } = history
  const onClose = React.useCallback(() => {
    if (!match) return

    const { bucket, name } = packageHandle
    // `bucketPackageDetail` only, because `bucketPackageAddFiles` is on top of "latest", not specific revision
    push(urls.bucketPackageDetail(bucket, name))
  }, [match, packageHandle, push, urls])

  const location = RRDom.useLocation()
  const createDialog = PD.useCreateDialog({
    src: packageHandle,
    dst: packageHandle,
    onClose,
  })

  const { open, close, isOpen } = createDialog

  const shouldClose = React.useMemo(() => !match && isOpen, [match, isOpen])
  const shouldOpen = React.useMemo(() => match && !isOpen, [match, isOpen])

  React.useEffect(() => {
    if (shouldClose) {
      close()
    }
  }, [shouldClose, close])
  React.useEffect(() => {
    if (shouldOpen) {
      open({ files: parseFilesQueryString(location.search) })
    }
  }, [shouldOpen, open, location.search])

  return createDialog
}

const useDirDisplayStyles = M.makeStyles((t) => ({
  button: {
    flexShrink: 0,
    marginBottom: '-3px',
    marginLeft: t.spacing(1),
    marginTop: '-3px',
  },
}))

interface DirDisplayProps {
  packageHandle: PackageHandle
  hashOrTag: string
  path: string
  crumbs: BreadCrumbs.Crumb[]
}

function DirDisplay({ packageHandle, hashOrTag, path, crumbs }: DirDisplayProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()
  const classes = useDirDisplayStyles()

  const dirQuery = GQL.useQuery(DIR_QUERY, {
    ...packageHandle,
    path: s3paths.ensureNoSlash(path),
  })

  const { bucket, name, hash } = packageHandle

  const updateDialog = useCreateDialog(packageHandle)

  const mkUrl = React.useCallback(
    (handle) => urls.bucketPackageTree(bucket, name, hashOrTag, handle.logicalKey),
    [urls, bucket, name, hashOrTag],
  )

  usePrevious({ bucket, name, hashOrTag }, (prev) => {
    // close the dialog when navigating away
    if (prev && !R.equals({ bucket, name, hashOrTag }, prev)) updateDialog.close()
  })

  const { prefs } = BucketPreferences.use()

  const redirectToPackagesList = React.useCallback(() => {
    history.push(urls.bucketPackageList(bucket))
  }, [bucket, history, urls])

  const [deletionState, setDeletionState] = React.useState({
    error: undefined as React.ReactNode | undefined,
    loading: false,
    opened: false,
  })

  const confirmDelete = React.useCallback(
    () => setDeletionState(R.assoc('opened', true)),
    [],
  )

  const onPackageDeleteDialogClose = React.useCallback(() => {
    setDeletionState(
      R.mergeLeft({
        error: undefined,
        opened: false,
      }),
    )
  }, [])

  const deleteRevision = GQL.useMutation(DELETE_REVISION)

  const handlePackageDeletion = React.useCallback(async () => {
    setDeletionState(R.assoc('loading', true))
    try {
      const { packageRevisionDelete: r } = await deleteRevision({ bucket, name, hash })
      switch (r.__typename) {
        case 'PackageRevisionDeleteSuccess':
          setDeletionState(R.mergeLeft({ opened: false, loading: false }))
          redirectToPackagesList()
          return
        case 'OperationError':
          setDeletionState(R.mergeLeft({ error: r.message, loading: false }))
          return
        default:
          assertNever(r)
      }
    } catch (e: any) {
      let error = 'Unexpected error'
      if (e.message) error = `${error}: ${e.message}`
      setDeletionState(R.mergeLeft({ error, loading: false }))
    }
  }, [bucket, hash, name, deleteRevision, redirectToPackagesList, setDeletionState])

  const prompt = FileEditor.useCreateFileInPackage(packageHandle, path)
  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within a Selection.Provider')
  const handleSelection = React.useCallback(
    (ids) => slt.merge(ids, bucket, path),
    [bucket, path, slt],
  )
  const packageUri = React.useMemo(
    () => ({
      bucket,
      name,
      hash,
      path,
      catalog: window.location.hostname,
    }),
    [bucket, name, hash, path],
  )

  const [successor, setSuccessor] = React.useState<workflows.Successor | null>(null)
  const closeCopyDialog = React.useCallback(() => setSuccessor(null), [])

  return (
    <>
      <PD.Copy
        onClose={closeCopyDialog}
        src={packageHandle}
        successor={successor}
        key={successor?.slug || 'none'}
      />

      <RevisionDeleteDialog
        error={deletionState.error}
        open={deletionState.opened}
        packageHandle={packageHandle}
        onClose={onPackageDeleteDialogClose}
        loading={deletionState.loading}
        onDelete={handlePackageDeletion}
      />

      {updateDialog.render({
        resetFiles: 'Undo changes',
        submit: 'Push',
        successBrowse: 'Browse',
        successTitle: 'Push complete',
        successRenderMessage: ({ packageLink }) => (
          <>Package revision {packageLink} successfully created</>
        ),
        title: 'Push package revision',
      })}

      {GQL.fold(dirQuery, {
        // TODO: skeleton placeholder
        fetching: () => (
          <>
            <TopBar crumbs={crumbs} />
            <M.Box mt={2}>
              <M.CircularProgress />
            </M.Box>
          </>
        ),
        data: (d) => {
          const dir = d.package?.revision?.dir
          if (!dir) {
            return (
              <>
                <TopBar crumbs={crumbs} />
                <M.Box mt={4}>
                  <M.Typography variant="h4" align="center" gutterBottom>
                    Error loading directory
                  </M.Typography>
                  <M.Typography variant="body1" align="center">
                    Seems like there's no such directory in this package
                  </M.Typography>
                </M.Box>
              </>
            )
          }

          const items: Listing.Item[] = Listing.format(
            dir.children.map((c) => {
              switch (c.__typename) {
                case 'PackageFile':
                  return Listing.Entry.File({
                    key: c.path,
                    size: c.size,
                    physicalKey: c.physicalKey,
                  })
                case 'PackageDir':
                  return Listing.Entry.Dir({ key: c.path, size: c.size })
                default:
                  return assertNever(c)
              }
            }),
            {
              urls,
              bucket,
              packageHandle: { bucket, name, hashOrTag },
              prefix: path,
            },
          )

          const summaryHandles = dir.children
            .map((c) =>
              c.__typename === 'PackageFile'
                ? {
                    ...s3paths.parseS3Url(c.physicalKey),
                    logicalKey: c.path,
                  }
                : null,
            )
            .filter(Boolean)

          return (
            <>
              {prompt.render()}
              <TopBar crumbs={crumbs}>
                {BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { actions, blocks } }) => (
                      <>
                        {actions.downloadPackage && (
                          <Selection.Control
                            className={classes.button}
                            packageHandle={packageHandle}
                          />
                        )}
                        {actions.revisePackage && (
                          <M.Button
                            className={classes.button}
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => updateDialog.open()}
                          >
                            Revise package
                          </M.Button>
                        )}
                        {actions.copyPackage && (
                          <Successors.Button
                            className={classes.button}
                            bucket={bucket}
                            icon="exit_to_app"
                            onChange={setSuccessor}
                          >
                            Push to bucket
                          </Successors.Button>
                        )}
                        {actions.downloadPackage && (
                          <Download.Button
                            className={classes.button}
                            label={
                              !packageUri.path && slt.isEmpty ? 'Get package' : undefined
                            }
                          >
                            <Download.PackageOptions
                              hashOrTag={hashOrTag}
                              hideCode={!blocks.code}
                              selection={slt.isEmpty ? undefined : slt.selection}
                              uri={packageUri}
                            />
                          </Download.Button>
                        )}
                        <RevisionMenu
                          className={classes.button}
                          onDelete={confirmDelete}
                          onCreateFile={prompt.open}
                        />
                      </>
                    ),
                    Pending: () => (
                      <>
                        <Buttons.Skeleton className={classes.button} size="small" />
                        <Buttons.Skeleton className={classes.button} size="small" />
                        <Buttons.Skeleton className={classes.button} size="small" />
                        <Buttons.Skeleton className={classes.button} size="small" />
                      </>
                    ),
                    Init: () => null,
                  },
                  prefs,
                )}
              </TopBar>
              {BucketPreferences.Result.match(
                {
                  Ok: ({ ui: { blocks } }) => (
                    <>
                      {blocks.meta && (
                        <FileView.PackageMetaSection
                          meta={dir.metadata}
                          preferences={blocks.meta}
                        />
                      )}
                      <M.Box mt={2}>
                        {blocks.browser && (
                          <Listing.Listing
                            onSelectionChange={handleSelection}
                            selection={Selection.getDirectorySelection(
                              slt.selection,
                              bucket,
                              path,
                            )}
                            items={items}
                            key={hash}
                            onReload={dirQuery.run}
                          />
                        )}
                        <Summary
                          path={path}
                          files={summaryHandles}
                          mkUrl={mkUrl}
                          packageHandle={packageHandle}
                        />
                      </M.Box>
                    </>
                  ),
                  _: () => null,
                },
                prefs,
              )}
            </>
          )
        },
      })}
    </>
  )
}

const withPreview = (
  { archived, deleted }: ObjectAttrs,
  handle: LogicalKeyResolver.S3SummarizeHandle,
  mode: FileType | null,
  callback: (res: $TSFixMe) => JSX.Element,
) => {
  if (deleted) {
    return callback(AsyncResult.Err(Preview.PreviewError.Deleted({ handle })))
  }
  if (archived) {
    return callback(AsyncResult.Err(Preview.PreviewError.Archived({ handle })))
  }
  const previewOptions = { mode, context: Preview.CONTEXT.FILE }
  return Preview.load(handle, callback, previewOptions)
}

interface ObjectAttrs {
  archived: boolean
  deleted: boolean
  lastModified?: Date
  size?: number
}

type CrumbProp = $TSFixMe

interface FileDisplaySkeletonProps {
  crumbs: CrumbProp[]
}

function FileDisplaySkeleton({ crumbs }: FileDisplaySkeletonProps) {
  return (
    // TODO: skeleton placeholder
    <>
      <TopBar crumbs={crumbs} />
      <M.Box mt={2}>
        <M.CircularProgress />
      </M.Box>
    </>
  )
}

interface FileDisplayErrorProps {
  crumbs: CrumbProp[]
  detail?: React.ReactNode
  headline: React.ReactNode
}

function FileDisplayError({ crumbs, detail, headline }: FileDisplayErrorProps) {
  return (
    <>
      <TopBar crumbs={crumbs} />
      <M.Box mt={4}>
        <M.Typography variant="h4" align="center" gutterBottom>
          {headline}
        </M.Typography>
        {!!detail && (
          <M.Typography variant="body1" align="center">
            {detail}
          </M.Typography>
        )}
      </M.Box>
    </>
  )
}
interface FileDisplayQueryProps {
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
  crumbs: BreadCrumbs.Crumb[]
  mode?: string
}

function FileDisplayQuery({
  bucket,
  name,
  hash,
  path,
  crumbs,
  ...props
}: FileDisplayQueryProps) {
  const { urls } = NamedRoutes.use()
  const fileQuery = GQL.useQuery(FILE_QUERY, { bucket, name, hash, path })
  return GQL.fold(fileQuery, {
    fetching: () => <FileDisplaySkeleton crumbs={crumbs} />,
    data: (d) => {
      const file = d.package?.revision?.file

      if (!file) {
        if (d.package?.revision?.dir) {
          return (
            <RRDom.Redirect
              to={urls.bucketPackageTree(
                bucket,
                name,
                props.hashOrTag,
                s3paths.ensureSlash(path),
              )}
            />
          )
        }
        // eslint-disable-next-line no-console
        if (fileQuery.error) console.error(fileQuery.error)
        return (
          <FileDisplayError
            headline="Error loading file"
            detail="Seems like there's no such file in this package"
            crumbs={crumbs}
          />
        )
      }

      return <FileDisplay {...{ bucket, name, hash, path, crumbs, file }} {...props} />
    },
  })
}

interface RouteMap {
  bucketDir: Routes.BucketDirArgs
  bucketFile: Routes.BucketFileArgs
  bucketPackageTree: Routes.BucketPackageTreeArgs
  bucketPackageDetail: Routes.BucketPackageDetailArgs
  bucketPackageAddFiles: Routes.BucketPackageAddFilesArgs
  bucketPackageList: Routes.BucketPackageListArgs
}

const useFileDisplayStyles = M.makeStyles((t) => ({
  button: {
    marginLeft: t.spacing(1),
  },
  fileProperties: {
    marginRight: t.spacing(1),
  },
  preview: {
    width: '100%',
  },
}))

interface FileContextProps {
  pkg: {
    bucket: string
    name: string
    hash: string
  }
  file: Model.GQLTypes.PackageFile
}

const FileContext = Assistant.Context.LazyContext(({ pkg, file }: FileContextProps) => {
  const msg = React.useMemo(() => {
    const s3loc = s3paths.parseS3Url(file.physicalKey)
    return XML.tag('viewport')
      .children(
        'You are currently viewing a file in a package.',
        XML.tag(
          'package',
          pkg,
          XML.tag(
            'package-entry',
            { path: file.path, size: file.size },
            'You can use the physicalLocation to access the file in S3 (always provide version if available)',
            XML.tag('physicalLocation', {}, JSON.stringify(s3loc, null, 2)),
            file.metadata &&
              XML.tag('metadata', {}, JSON.stringify(file.metadata, null, 2)),
          ),
        ),
      )
      .toString()
  }, [file, pkg])

  return {
    messages: [msg],
  }
})

interface FileDisplayProps extends FileDisplayQueryProps {
  file: Model.GQLTypes.PackageFile
}

function FileDisplay({
  bucket,
  mode,
  name,
  hash,
  hashOrTag,
  path,
  crumbs,
  file,
}: FileDisplayProps) {
  const s3 = AWS.S3.use()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()
  const classes = useFileDisplayStyles()
  const { prefs } = BucketPreferences.use()

  const packageHandle = React.useMemo(
    () => ({ bucket, name, hash }),
    [bucket, name, hash],
  )

  const viewModes = useViewModes(mode)

  const onViewModeChange = React.useCallback(
    (m) => {
      history.push(urls.bucketPackageTree(bucket, name, hashOrTag, path, m.valueOf()))
    },
    [bucket, history, name, path, hashOrTag, urls],
  )

  const handle: LogicalKeyResolver.S3SummarizeHandle = React.useMemo(
    () => ({
      ...s3paths.parseS3Url(file.physicalKey),
      logicalKey: file.path,
      packageHandle,
    }),
    [file, packageHandle],
  )

  const { push } = Notifications.use()
  const editUrl = FileEditor.useEditFileInPackage(packageHandle, handle)
  const handleEdit = React.useCallback(() => {
    try {
      history.push(editUrl(path))
    } catch (error) {
      Log.error(error)
      if (error instanceof Error) push(error.message)
    }
  }, [editUrl, history, path, push])
  const packageUri = React.useMemo(
    () => ({
      ...packageHandle,
      path: file.path,
      catalog: window.location.hostname,
    }),
    [packageHandle, file.path],
  )

  return (
    // @ts-expect-error
    <Data fetch={requests.getObjectExistence} params={{ s3, ...handle }}>
      {AsyncResult.case({
        _: () => <FileDisplaySkeleton crumbs={crumbs} />,
        Err: (e: $TSFixMe) => {
          if (e.code === 'Forbidden') {
            return (
              <FileDisplayError
                headline="Access Denied"
                detail="You don't have access to this object"
                crumbs={crumbs}
              />
            )
          }
          // eslint-disable-next-line no-console
          console.error(e)
          return (
            <FileDisplayError
              headline="Error loading file"
              detail="Something went wrong"
              crumbs={crumbs}
            />
          )
        },
        Ok: requests.ObjectExistence.case({
          Exists: ({ archived, deleted, lastModified, size }: ObjectAttrs) => (
            <>
              <FileContext file={file} pkg={packageHandle} />
              <TopBar crumbs={crumbs}>
                <FileProperties
                  className={classes.fileProperties}
                  lastModified={lastModified}
                  size={size}
                />
                {BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { actions } }) =>
                      FileEditor.isSupportedFileType(path) &&
                      hashOrTag === 'latest' &&
                      actions.revisePackage && (
                        <Buttons.Iconized
                          className={classes.button}
                          icon="edit"
                          label="Edit"
                          onClick={handleEdit}
                        />
                      ),
                    Pending: () => (
                      <Buttons.Skeleton className={classes.button} size="small" />
                    ),
                    Init: () => null,
                  },
                  prefs,
                )}
                {!!viewModes.modes.length && (
                  <FileView.ViewModeSelector
                    className={classes.button}
                    // @ts-expect-error
                    options={viewModes.modes.map(viewModeToSelectOption)}
                    // @ts-expect-error
                    value={viewModeToSelectOption(viewModes.mode)}
                    onChange={onViewModeChange}
                  />
                )}
                {BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { actions, blocks } }) => (
                      <>
                        {!cfg.noDownload &&
                          !deleted &&
                          !archived &&
                          actions.downloadPackage && (
                            <Download.Button className={classes.button} label="Get file">
                              <Download.PackageOptions
                                fileHandle={handle}
                                hashOrTag={hashOrTag}
                                uri={packageUri}
                                hideCode={!blocks.code}
                              />
                            </Download.Button>
                          )}
                        {blocks.qurator && !deleted && !archived && <AssistButton />}
                      </>
                    ),
                    Pending: () => (
                      <Buttons.Skeleton className={classes.button} size="small" />
                    ),
                    Init: () => null,
                  },
                  prefs,
                )}
              </TopBar>
              {BucketPreferences.Result.match(
                {
                  Ok: ({ ui: { blocks } }) =>
                    blocks.meta && (
                      <>
                        <FileView.ObjectMetaSection meta={file.metadata} />
                        <FileView.ObjectTags handle={handle} />
                      </>
                    ),
                  _: () => null,
                },
                prefs,
              )}
              <Section icon="remove_red_eye" heading="Preview" expandable={false}>
                <div className={classes.preview}>
                  {withPreview(
                    { archived, deleted },
                    handle,
                    viewModes.mode,
                    renderPreview(viewModes.handlePreviewResult),
                  )}
                </div>
              </Section>
            </>
          ),
          _: () => <FileDisplayError headline="No Such Object" crumbs={crumbs} />,
        }),
      })}
    </Data>
  )
}

interface ResolverProviderProps {
  packageHandle: PackageHandle
}

function ResolverProvider({
  packageHandle,
  children,
}: React.PropsWithChildren<ResolverProviderProps>) {
  const client = urql.useClient()
  // XXX: consider optimization: check current level (objects) for quick response
  // const found = objects.find((o) => o.name === logicalKey)
  // if (found) return s3paths.parseS3Url(found.physicalKey)
  const resolveLogicalKey = React.useCallback(
    (path: string) =>
      client
        .query(FILE_QUERY, { ...packageHandle, path })
        .toPromise()
        .then((r) => {
          const file = r.data?.package?.revision?.file
          if (!file) throw r.error || new Error(`Could not resolve logical key "${path}"`)
          return {
            ...s3paths.parseS3Url(file.physicalKey),
            logicalKey: file.path,
            size: file.size,
          }
        }),
    [client, packageHandle],
  )

  return (
    <LogicalKeyResolver.Provider value={resolveLogicalKey}>
      {children}
    </LogicalKeyResolver.Provider>
  )
}

type RevisionData = NonNullable<
  GQL.DataForDoc<typeof REVISION_QUERY>['package']
>['revision']

const useStyles = M.makeStyles({
  alertMsg: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

interface PackageRevisionProps {
  packageHandle: PackageHandle
  hashOrTag: string
  path: string
  crumbs: BreadCrumbs.Crumb[]
  mode?: string
  revision?: RevisionData
}

function PackageRevision({
  packageHandle,
  hashOrTag,
  path,
  crumbs,
  mode,
  revision,
}: PackageRevisionProps) {
  const isDir = path === '' || path.endsWith('/')

  return (
    <>
      <ResolverProvider packageHandle={packageHandle}>
        <AssistantContext.PackageContext
          bucket={packageHandle.bucket}
          name={packageHandle.name}
          path={path}
          revision={revision ?? null}
        />
        {isDir ? (
          <DirDisplay
            packageHandle={packageHandle}
            {...{ hashOrTag, path }}
            {...{ crumbs }}
          />
        ) : (
          <FileDisplayQuery
            {...packageHandle}
            {...{ hashOrTag, path }}
            {...{ crumbs, mode }}
          />
        )}
      </ResolverProvider>
    </>
  )
}

interface PackageTreeProps {
  bucket: string
  name: string
  hashOrTag: string
  revision?: RevisionData
  path: string
  mode?: string
  resolvedFrom?: string
  revisionListQuery: GQL.QueryResultForDoc<typeof REVISION_LIST_QUERY>
}

function PackageTree({
  bucket,
  name,
  hashOrTag,
  revision,
  path,
  mode,
  resolvedFrom,
  revisionListQuery,
}: PackageTreeProps) {
  const hash = revision?.hash
  const classes = useStyles()
  const { urls } = NamedRoutes.use<PackageRoutes>()

  // TODO: use urql to get bucket config
  // const data = useQuery({
  //   ..
  // })
  //
  // const bucketCfg = data?.bucket.config

  const getSegmentRoute = React.useCallback(
    (segPath: string) => urls.bucketPackageTree(bucket, name, hashOrTag, segPath),
    [bucket, hashOrTag, name, urls],
  )
  const crumbs = BreadCrumbs.use(path, getSegmentRoute, 'ROOT', {
    tailSeparator: path.endsWith('/'),
  })

  const packageHandle = React.useMemo(
    () => (hash ? { bucket, name, hash } : null),
    [bucket, name, hash],
  )

  const slt = Selection.use()
  invariant(slt.inited, 'Selection must be used within a Selection.Provider')
  const guardNavigation = React.useCallback(
    (location) =>
      isStillBrowsingPackage(urls, location.pathname, {
        bucket,
        name,
        hashOrTag,
        hash,
      }) || 'Selection will be lost. Clear selection and confirm navigation?',
    [urls, bucket, name, hashOrTag, hash],
  )

  return (
    <FileView.Root>
      <RRDom.Prompt when={!slt.isEmpty} message={guardNavigation} />
      {/* TODO: bring back linked data after re-implementing it using graphql
      {!!bucketCfg &&
        revisionData.case({
          Ok: ({ hash, modified }) => (
            <ExposeLinkedData {...{ bucketCfg, bucket, name, hash, modified }} />
          ),
          _: () => null,
        })}
      */}
      {!!resolvedFrom && (
        <M.Box mb={2}>
          <Lab.Alert
            severity="info"
            icon={false}
            classes={{ message: classes.alertMsg }}
            action={
              <M.IconButton
                size="small"
                color="inherit"
                component={RRDom.Link}
                to={urls.bucketPackageTree(bucket, name, hashOrTag, path)}
              >
                <M.Icon fontSize="small">close</M.Icon>
              </M.IconButton>
            }
          >
            Resolved from{' '}
            <M.Box
              fontFamily="monospace.fontFamily"
              fontWeight="fontWeightBold"
              component="span"
              title={resolvedFrom}
            >
              {resolvedFrom}
            </M.Box>
          </Lab.Alert>
        </M.Box>
      )}
      <M.Typography variant="body1">
        <PackageLink {...{ bucket, name }} />
        {' @ '}
        <RevisionInfo {...{ hash, hashOrTag, bucket, name, path, revisionListQuery }} />
      </M.Typography>
      {packageHandle ? (
        <PackageRevision
          packageHandle={packageHandle}
          hashOrTag={hashOrTag}
          path={path}
          crumbs={crumbs}
          mode={mode}
        />
      ) : (
        <>
          <TopBar crumbs={crumbs} />
          <M.Box mt={4}>
            <M.Typography variant="h4" align="center" gutterBottom>
              Error resolving revision
            </M.Typography>
            <M.Typography variant="body1" align="center">
              Revision{' '}
              <M.Box
                component="span"
                fontWeight="fontWeightMedium"
              >{`"${hashOrTag}"`}</M.Box>{' '}
              could not be resolved.
            </M.Typography>
          </M.Box>
        </>
      )}
    </FileView.Root>
  )
}

interface PackageTreeQueriesProps {
  bucket: string
  name: string
  hashOrTag: string
  path: string
  resolvedFrom?: string
  mode?: string
}

function PackageTreeQueries({
  bucket,
  name,
  hashOrTag,
  path,
  resolvedFrom,
  mode,
}: PackageTreeQueriesProps) {
  const revisionQuery = GQL.useQuery(REVISION_QUERY, { bucket, name, hashOrTag })
  const revisionListQuery = GQL.useQuery(REVISION_LIST_QUERY, { bucket, name })

  return GQL.fold(revisionQuery, {
    fetching: () => <Placeholder color="text.secondary" />,
    error: (e) => errors.displayError()(e),
    data: (d) => {
      if (!d.package) {
        return (
          <Message headline="No Such Package">
            Package named{' '}
            <M.Box component="span" fontWeight="fontWeightMedium">{`"${name}"`}</M.Box>{' '}
            could not be found in this bucket.
          </Message>
        )
      }

      return (
        <Selection.Provider>
          <PackageTree
            {...{
              bucket,
              name,
              hashOrTag,
              revision: d.package.revision,
              path,
              mode,
              resolvedFrom,
              revisionListQuery,
            }}
          />
        </Selection.Provider>
      )
    },
  })
}

interface PackageTreeRouteParams {
  bucket: string
  name: string
  revision?: string
  path?: string
}

export default function PackageTreeWrapper() {
  const {
    bucket,
    name,
    revision: hashOrTag = 'latest',
    path: encodedPath = '',
  } = RRDom.useParams<PackageTreeRouteParams>()
  const location = RRDom.useLocation()
  invariant(!!bucket, '`bucket` must be defined')
  invariant(!!name, '`name` must be defined')

  const path = s3paths.decode(encodedPath)
  // TODO: mode is "switch view mode" action, ex. mode=json, or type=json, or type=application/json
  const { resolvedFrom, mode } = parseSearch(location.search, true)
  return (
    <>
      <MetaTitle>{[`${name}@${R.take(10, hashOrTag)}/${path}`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <PackageTreeQueries {...{ bucket, name, hashOrTag, path, resolvedFrom, mode }} />
      </WithPackagesSupport>
    </>
  )
}
