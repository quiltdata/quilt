import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as urql from 'urql'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import Message from 'components/Message'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import cfg from 'constants/config'
import type * as Routes from 'constants/routes'
import * as OpenInDesktop from 'containers/OpenInDesktop'
import * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import Data from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import usePrevious from 'utils/usePrevious'
import * as workflows from 'utils/workflows'

import PackageCodeSamples from '../CodeSamples/Package'
import * as Download from '../Download'
import { FileProperties } from '../FileProperties'
import * as FileView from '../FileView'
import * as Listing from '../Listing'
import PackageCopyDialog from '../PackageCopyDialog'
import * as PD from '../PackageDialog'
import Section from '../Section'
import * as Successors from '../Successors'
import Summary from '../Summary'
import WithPackagesSupport from '../WithPackagesSupport'
import * as errors from '../errors'
import renderPreview from '../renderPreview'
import * as requests from '../requests'
import { FileType, useViewModes, viewModeToSelectOption } from '../viewModes'
import PackageLink from './PackageLink'
import RevisionDeleteDialog from './RevisionDeleteDialog'
import RevisionInfo from './RevisionInfo'
import RevisionMenu from './RevisionMenu'

import REVISION_QUERY from './gql/Revision.generated'
import REVISION_LIST_QUERY from './gql/RevisionList.generated'
import DIR_QUERY from './gql/Dir.generated'
import FILE_QUERY from './gql/File.generated'
import DELETE_REVISION from './gql/DeleteRevision.generated'

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

const useDirDisplayStyles = M.makeStyles((t) => ({
  button: {
    flexShrink: 0,
    marginBottom: '-3px',
    marginLeft: t.spacing(1),
    marginTop: '-3px',
  },
}))

interface DirDisplayProps {
  handle: Model.Package.Handle
  hash: Model.Package.Hash
  path: string
  crumbs: BreadCrumbs.Crumb[]
  size?: number
}

function DirDisplay({ handle, hash, path, crumbs, size }: DirDisplayProps) {
  const initialActions = PD.useInitialActions()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()
  const classes = useDirDisplayStyles()

  const dirQuery = GQL.useQuery(DIR_QUERY, {
    ...handle,
    hash: hash.value,
    path: s3paths.ensureNoSlash(path),
  })

  const mkUrl = React.useCallback(
    (h) => urls.bucketPackageTree(handle, hash, h.logicalKey),
    [urls, handle, hash],
  )

  const [initialOpen] = React.useState(initialActions.includes('revisePackage'))

  const updateDialog = PD.usePackageCreationDialog({
    initialOpen,
    bucket: handle.bucket,
    src: { name: handle.name, hash: hash.value },
  })

  const [successor, setSuccessor] = React.useState<workflows.Successor | null>(null)

  const onPackageCopyDialogExited = React.useCallback(() => {
    setSuccessor(null)
  }, [setSuccessor])

  usePrevious({ handle, hash }, (prev) => {
    // close the dialog when navigating away
    if (!R.equals({ handle, hash }, prev)) updateDialog.close()
  })

  const prefs = BucketPreferences.use()

  const redirectToPackagesList = React.useCallback(() => {
    history.push(urls.bucketPackageList(handle.bucket))
  }, [handle, history, urls])

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
      const { packageRevisionDelete: r } = await deleteRevision({
        ...handle,
        hash: hash.value,
      })
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
  }, [handle, hash, deleteRevision, redirectToPackagesList, setDeletionState])

  const openInDesktopState = OpenInDesktop.use(handle, hash, size)

  const prompt = FileEditor.useCreateFileInPackage(handle, path)

  return (
    <>
      <OpenInDesktop.Dialog
        open={openInDesktopState.confirming}
        onClose={openInDesktopState.unconfirm}
        onConfirm={openInDesktopState.openInDesktop}
        size={size}
      />

      <PackageCopyDialog
        handle={handle}
        hash={hash}
        open={!!successor}
        successor={successor}
        onExited={onPackageCopyDialogExited}
      />

      <RevisionDeleteDialog
        error={deletionState.error}
        open={deletionState.opened}
        handle={handle}
        hash={hash}
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
              const entryOptions = {
                location: { bucket: handle.bucket, key: c.path },
                size: c.size,
              }
              switch (c.__typename) {
                case 'PackageFile':
                  return Listing.Entry.File(entryOptions)
                case 'PackageDir':
                  return Listing.Entry.Dir(entryOptions)
                default:
                  return assertNever(c)
              }
            }),
            {
              urls,
              bucket: handle.bucket,
              handle,
              hash,
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

          const downloadPath = path
            ? `package/${handle.bucket}/${handle.name}/${hash.value}/${path}`
            : `package/${handle.bucket}/${handle.name}/${hash.value}`

          return (
            <>
              {prompt.render()}
              <TopBar crumbs={crumbs}>
                {BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { actions } }) => (
                      <>
                        {actions.revisePackage && (
                          <M.Button
                            className={classes.button}
                            variant="contained"
                            color="primary"
                            size="small"
                            style={{ marginTop: -3, marginBottom: -3, flexShrink: 0 }}
                            onClick={() => updateDialog.open()}
                          >
                            Revise package
                          </M.Button>
                        )}
                        {actions.copyPackage && (
                          <Successors.Button
                            className={classes.button}
                            bucket={handle.bucket}
                            icon="exit_to_app"
                            onChange={setSuccessor}
                          >
                            Push to bucket
                          </Successors.Button>
                        )}
                        <Download.DownloadButton
                          className={classes.button}
                          label={path ? 'Download sub-package' : 'Download package'}
                          onClick={openInDesktopState.confirm}
                          path={downloadPath}
                        />
                        <RevisionMenu
                          className={classes.button}
                          onDelete={confirmDelete}
                          onDesktop={openInDesktopState.confirm}
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
                      {blocks.code && (
                        <PackageCodeSamples handle={handle} hash={hash} path={path} />
                      )}
                      {blocks.meta && (
                        <FileView.PackageMetaSection
                          meta={dir.metadata}
                          preferences={blocks.meta}
                        />
                      )}
                      <M.Box mt={2}>
                        {blocks.browser && (
                          <Listing.Listing items={items} key={hash.value} />
                        )}
                        <Summary
                          files={summaryHandles}
                          mkUrl={mkUrl}
                          handle={handle}
                          hash={hash}
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
  location: LogicalKeyResolver.S3SummarizeHandle,
  mode: FileType | null,
  callback: (res: $TSFixMe) => JSX.Element,
  handle: Model.Package.Handle,
  hash: Model.Package.Hash,
) => {
  if (deleted) {
    return callback(AsyncResult.Err(Preview.PreviewError.Deleted({ handle: location })))
  }
  if (archived) {
    return callback(AsyncResult.Err(Preview.PreviewError.Archived({ handle: location })))
  }
  const previewOptions = {
    handle,
    hash,
    mode,
    context: Preview.CONTEXT.FILE,
  }
  return Preview.load(location, callback, previewOptions)
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
  handle: Model.Package.Handle
  hash: Model.Package.Hash
  path: string
  crumbs: BreadCrumbs.Crumb[]
  mode?: string
}

function FileDisplayQuery({
  handle,
  hash,
  path,
  crumbs,
  ...props
}: FileDisplayQueryProps) {
  const fileQuery = GQL.useQuery(FILE_QUERY, { ...handle, hash: hash.value, path })
  return GQL.fold(fileQuery, {
    fetching: () => <FileDisplaySkeleton crumbs={crumbs} />,
    data: (d) => {
      const file = d.package?.revision?.file

      if (!file) {
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

      return <FileDisplay {...{ handle, hash, path, crumbs, file }} {...props} />
    },
  })
}

interface RouteMap {
  bucketDir: Routes.BucketDirArgs
  bucketFile: Routes.BucketFileArgs
  bucketPackageTree: Routes.BucketPackageTreeArgs
  bucketPackageDetail: Routes.BucketPackageDetailArgs
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

interface FileDisplayProps extends FileDisplayQueryProps {
  file: Model.GQLTypes.PackageFile
}

function FileDisplay({ handle, mode, hash, path, crumbs, file }: FileDisplayProps) {
  const s3 = AWS.S3.use()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()
  const classes = useFileDisplayStyles()
  const prefs = BucketPreferences.use()

  const viewModes = useViewModes(mode)

  const onViewModeChange = React.useCallback(
    (m) => {
      history.push(urls.bucketPackageTree(handle, hash, path, m.valueOf()))
    },
    [handle, history, path, hash, urls],
  )

  const handleEdit = React.useCallback(() => {
    const next = urls.bucketPackageDetail(handle, {
      action: 'revisePackage',
    })
    const physicalHandle = s3paths.parseS3Url(file.physicalKey)
    const editUrl = urls.bucketFile(physicalHandle, {
      add: path,
      edit: true,
      next,
    })
    history.push(editUrl)
  }, [file, handle, history, path, urls])

  const h: LogicalKeyResolver.S3SummarizeHandle = React.useMemo(
    () => ({
      ...s3paths.parseS3Url(file.physicalKey),
      logicalKey: file.path,
    }),
    [file],
  )

  return (
    // @ts-expect-error
    <Data fetch={requests.getObjectExistence} params={{ s3, location: h }}>
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
                      hash.alias === 'latest' &&
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
                {!cfg.noDownload && !deleted && !archived && (
                  <FileView.DownloadButton className={classes.button} handle={h} />
                )}
              </TopBar>
              {BucketPreferences.Result.match(
                {
                  Ok: ({ ui: { blocks } }) => (
                    <>
                      {blocks.code && (
                        <PackageCodeSamples handle={handle} hash={hash} path={path} />
                      )}
                      {blocks.meta && (
                        <>
                          <FileView.ObjectMetaSection meta={file.metadata} />
                          <FileView.ObjectTags location={h} />
                        </>
                      )}
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
                    h,
                    viewModes.mode,
                    renderPreview(viewModes.handlePreviewResult),
                    handle,
                    hash,
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
  handle: Model.Package.Handle
  hash: Model.Package.Hash
}

function ResolverProvider({
  handle,
  hash,
  children,
}: React.PropsWithChildren<ResolverProviderProps>) {
  const client = urql.useClient()
  // XXX: consider optimization: check current level (objects) for quick response
  // const found = objects.find((o) => o.name === logicalKey)
  // if (found) return s3paths.parseS3Url(found.physicalKey)
  const resolveLogicalKey = React.useCallback(
    (path: string) =>
      client
        .query(FILE_QUERY, { ...handle, hash: hash.value, path })
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
    [client, handle, hash],
  )

  return (
    <LogicalKeyResolver.Provider value={resolveLogicalKey}>
      {children}
    </LogicalKeyResolver.Provider>
  )
}

const useStyles = M.makeStyles({
  alertMsg: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

interface PackageTreeProps {
  handle: Model.Package.Handle
  revision: Model.Package.Revision
  mode?: string
  path: string
  resolvedFrom?: string
  revisionListQuery: GQL.QueryResultForDoc<typeof REVISION_LIST_QUERY>
  size?: number
}

function PackageTree({
  handle,
  revision,
  path,
  mode,
  resolvedFrom,
  revisionListQuery,
  size,
}: PackageTreeProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  // TODO: use urql to get bucket config
  // const data = useQuery({
  //   ..
  // })
  //
  // const bucketCfg = data?.bucket.config

  const isDir = s3paths.isDir(path)

  const getSegmentRoute = React.useCallback(
    (segPath: string) => urls.bucketPackageTree(handle, revision, segPath),
    [handle, revision, urls],
  )
  const crumbs = BreadCrumbs.use(path, getSegmentRoute, 'ROOT', {
    tailSeparator: path.endsWith('/'),
  })

  return (
    <FileView.Root>
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
                to={urls.bucketPackageTree(handle, revision, path)}
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
        <PackageLink handle={handle} />
        {' @ '}
        <RevisionInfo {...{ revision, handle, path, revisionListQuery }} />
      </M.Typography>
      {Model.Package.isPackageHash(revision) ? (
        <ResolverProvider {...{ handle, hash: revision }}>
          {isDir ? (
            <DirDisplay
              {...{
                handle,
                hash: revision,
                path,
                crumbs,
                size,
              }}
            />
          ) : (
            <FileDisplayQuery {...{ handle, mode, hash: revision, path, crumbs }} />
          )}
        </ResolverProvider>
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
              >{`"${revision.alias}"`}</M.Box>{' '}
              could not be resolved.
            </M.Typography>
          </M.Box>
        </>
      )}
    </FileView.Root>
  )
}

interface PackageTreeQueriesProps {
  handle: Model.Package.Handle
  revision: Model.Package.Revision
  path: string
  resolvedFrom?: string
  mode?: string
}

function PackageTreeQueries({
  handle,
  revision,
  path,
  resolvedFrom,
  mode,
}: PackageTreeQueriesProps) {
  const revisionQuery = GQL.useQuery(REVISION_QUERY, {
    ...handle,
    hashOrTag: Model.Package.hashOrTag(revision),
  })
  const revisionListQuery = GQL.useQuery(REVISION_LIST_QUERY, handle)

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
        <PackageTree
          {...{
            handle,
            revision: R.assoc('value', d.package.revision?.hash, revision),
            size: d.package.revision?.totalBytes ?? undefined,
            path,
            mode,
            resolvedFrom,
            revisionListQuery,
          }}
        />
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

export default function PackageTreeWrapper({
  match: {
    params: { bucket, name, revision, path: encodedPath = '' },
  },
  location: l,
}: RRDom.RouteComponentProps<PackageTreeRouteParams>) {
  const path = s3paths.decode(encodedPath)
  const handle: Model.Package.Handle = { bucket, name }
  const rev: Model.Package.Revision = React.useMemo(() => {
    if (!revision) return { alias: 'latest' } as Model.Package.HashAlias
    if (revision === 'latest') return { alias: revision } as Model.Package.HashAlias
    return { value: revision } as Model.Package.Hash
  }, [revision])
  // TODO: mode is "switch view mode" action, ex. mode=json, or type=json, or type=application/json
  const { resolvedFrom, mode } = parseSearch(l.search, true)
  return (
    <>
      <MetaTitle>
        {[`${name}@${R.take(10, Model.Package.tagOrHash(rev))}/${path}`, bucket]}
      </MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <PackageTreeQueries {...{ handle, revision: rev, path, resolvedFrom, mode }} />
      </WithPackagesSupport>
    </>
  )
}
