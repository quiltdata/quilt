import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as urql from 'urql'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import ButtonIconized from 'components/ButtonIconized'
import * as FileEditor from 'components/FileEditor'
import Message from 'components/Message'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import cfg from 'constants/config'
import * as OpenInDesktop from 'containers/OpenInDesktop'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import Data from 'utils/Data'
import * as GQL from 'utils/GraphQL'
// import * as LinkedData from 'utils/LinkedData'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'
import assertNever from 'utils/assertNever'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import * as workflows from 'utils/workflows'

import Code from '../Code'
import * as Download from '../Download'
import { FileProperties } from '../FileProperties'
import * as FileView from '../FileView'
import Listing, { Item as ListingItem } from '../Listing'
import PackageCopyDialog from '../PackageCopyDialog'
import * as CreatePackage from '../PackageDialog/Provider'
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

interface PkgCodeProps {
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
}

function PkgCode({ bucket, name, hash, hashOrTag, path }: PkgCodeProps) {
  const pathCli = path && ` --path "${s3paths.ensureNoSlash(path)}"`
  const pathPy = path && `, path="${s3paths.ensureNoSlash(path)}"`
  const hashDisplay = hashOrTag === 'latest' ? '' : R.take(10, hash)
  const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
  const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
  const code = [
    {
      label: 'Python',
      hl: 'python',
      contents: dedent`
        import quilt3 as q3
        # Browse
        p = q3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")
        # make changes to package adding individual files
        p.set("data.csv", "data.csv")
        # or whole directories
        p.set_dir("subdir", "subdir")
        # and push changes
        q3.Package.push("${name}", registry="s3://${bucket}", message="Hello World")

        # Download (be mindful of large packages)
        q3.Package.install("${name}"${pathPy}${hashPy}, registry="s3://${bucket}", dest=".")
      `,
    },
    {
      label: 'CLI',
      hl: 'bash',
      contents:
        dedent`
          # Download package
          quilt3 install "${name}"${pathCli}${hashCli} --registry s3://${bucket} --dest .
        ` +
        (!path
          ? dedent`\n
              # Upload package
              echo "Hello World" > README.md
              quilt3 push "${name}" --registry s3://${bucket} --dir .
            `
          : ''),
    },
    {
      label: 'URI',
      contents: PackageUri.stringify({ bucket, name, hash, path }),
    },
  ]
  return <Code>{code}</Code>
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
  crumbs: $TSFixMe[] // Crumb
}

function TopBar({ crumbs, children }: React.PropsWithChildren<TopBarProps>) {
  const classes = useTopBarStyles()
  return (
    <div className={classes.topBar}>
      <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
        {renderCrumbs(crumbs)}
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
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
  crumbs: $TSFixMe[] // Crumb
  size?: number
}

function DirDisplay({
  bucket,
  name,
  hash,
  hashOrTag,
  path,
  crumbs,
  size,
}: DirDisplayProps) {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const classes = useDirDisplayStyles()

  const dirQuery = GQL.useQuery(DIR_QUERY, {
    bucket,
    name,
    hash,
    path: s3paths.ensureNoSlash(path),
  })

  const mkUrl = React.useCallback(
    (handle) => urls.bucketPackageTree(bucket, name, hashOrTag, handle.logicalKey),
    [urls, bucket, name, hashOrTag],
  )

  const [copySuccessor, setCopySuccessor] = React.useState<workflows.Successor | null>(
    null,
  )

  const onPackageCopyDialogExited = React.useCallback(() => {
    setCopySuccessor(null)
  }, [setCopySuccessor])

  const { preferences } = BucketPreferences.use()

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

  const packageHandle = React.useMemo(
    () => ({ bucket, name, hash }),
    [bucket, name, hash],
  )

  const openInDesktopState = OpenInDesktop.use(packageHandle, size)

  const prompt = FileEditor.useCreateFileInPackage(packageHandle, path)

  return (
    <>
      <OpenInDesktop.Dialog
        open={openInDesktopState.confirming}
        onClose={openInDesktopState.unconfirm}
        onConfirm={openInDesktopState.openInDesktop}
        size={size}
      />

      <PackageCopyDialog
        bucket={bucket}
        hash={hash}
        name={name}
        open={!!copySuccessor}
        successor={copySuccessor}
        onExited={onPackageCopyDialogExited}
      />

      <RevisionDeleteDialog
        error={deletionState.error}
        open={deletionState.opened}
        packageHandle={packageHandle}
        onClose={onPackageDeleteDialogClose}
        loading={deletionState.loading}
        onDelete={handlePackageDeletion}
      />

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

          const items: ListingItem[] = dir.children.map((c) => {
            switch (c.__typename) {
              case 'PackageFile':
                return {
                  type: 'file' as const,
                  name: basename(c.path),
                  to: urls.bucketPackageTree(bucket, name, hashOrTag, c.path),
                  size: c.size,
                }
              case 'PackageDir':
                return {
                  type: 'dir' as const,
                  name: basename(c.path),
                  to: urls.bucketPackageTree(
                    bucket,
                    name,
                    hashOrTag,
                    s3paths.ensureSlash(c.path),
                  ),
                  size: c.size,
                }
              default:
                return assertNever(c)
            }
          })
          if (path) {
            items.unshift({
              type: 'dir' as const,
              name: '..',
              to: urls.bucketPackageTree(bucket, name, hashOrTag, s3paths.up(path)),
            })
          }

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
            ? `package/${bucket}/${name}/${hash}/${path}`
            : `package/${bucket}/${name}/${hash}`
          // TODO: disable if nothing to revise on desktop
          const hasReviseButton = preferences?.ui?.actions?.revisePackage

          return (
            <>
              {prompt.render()}
              <TopBar crumbs={crumbs}>
                {hasReviseButton && (
                  <CreatePackage.Link>
                    <M.Button
                      className={classes.button}
                      variant="contained"
                      color="primary"
                      size="small"
                      style={{ marginTop: -3, marginBottom: -3, flexShrink: 0 }}
                    >
                      Revise package
                    </M.Button>
                  </CreatePackage.Link>
                )}
                {preferences?.ui?.actions?.copyPackage && (
                  <Successors.Button
                    className={classes.button}
                    bucket={bucket}
                    onChange={setCopySuccessor}
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
              </TopBar>
              {preferences?.ui?.blocks?.code && (
                <PkgCode {...{ ...packageHandle, hashOrTag, path }} />
              )}
              {!!preferences?.ui?.blocks?.meta && (
                <FileView.PackageMeta data={AsyncResult.Ok(dir.metadata)} />
              )}
              <M.Box mt={2}>
                {preferences?.ui?.blocks?.browser && <Listing items={items} key={hash} />}
                <Summary
                  path={path}
                  files={summaryHandles}
                  mkUrl={mkUrl}
                  packageHandle={packageHandle}
                />
              </M.Box>
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
  crumbs: $TSFixMe[] // Crumb
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
  const fileQuery = GQL.useQuery(FILE_QUERY, { bucket, name, hash, path })
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

      return <FileDisplay {...{ bucket, name, hash, path, crumbs, file }} {...props} />
    },
  })
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
  file: $TSFixMe
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
  const { urls } = NamedRoutes.use()
  const classes = useFileDisplayStyles()
  const { preferences } = BucketPreferences.use()

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

  const isEditable =
    FileEditor.isSupportedFileType(path) &&
    hashOrTag === 'latest' &&
    !!preferences?.ui?.actions?.revisePackage
  const handleEdit = React.useCallback(() => {
    const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
    const physicalHandle = s3paths.parseS3Url(file.physicalKey)
    const editUrl = urls.bucketFile(physicalHandle.bucket, physicalHandle.key, {
      add: path,
      edit: true,
      next,
    })
    history.push(editUrl)
  }, [file, bucket, history, name, path, urls])

  const handle: LogicalKeyResolver.S3SummarizeHandle = React.useMemo(
    () => ({
      ...s3paths.parseS3Url(file.physicalKey),
      logicalKey: file.path,
      packageHandle,
    }),
    [file, packageHandle],
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
              <TopBar crumbs={crumbs}>
                <FileProperties
                  className={classes.fileProperties}
                  lastModified={lastModified}
                  size={size}
                />
                {isEditable && (
                  <ButtonIconized
                    className={classes.button}
                    icon="edit"
                    label="Edit"
                    onClick={handleEdit}
                  />
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
                  <FileView.DownloadButton className={classes.button} handle={handle} />
                )}
              </TopBar>
              {preferences?.ui?.blocks?.code && (
                <PkgCode {...{ ...packageHandle, hashOrTag, path }} />
              )}
              {preferences?.ui?.blocks?.meta && (
                <FileView.ObjectMeta data={AsyncResult.Ok(file.metadata)} />
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
  bucket: string
  name: string
  hash: string
}

function ResolverProvider({
  bucket,
  name,
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
        .query(FILE_QUERY, { bucket, name, hash, path })
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
    [client, bucket, name, hash],
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
  bucket: string
  name: string
  hashOrTag: string
  hash?: string
  path: string
  mode?: string
  resolvedFrom?: string
  revisionListQuery: GQL.QueryResultForDoc<typeof REVISION_LIST_QUERY>
  size?: number
}

function PackageTree({
  bucket,
  name,
  hashOrTag,
  hash,
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

  const crumbs = React.useMemo(() => {
    const segments = [{ label: 'ROOT', path: '' }, ...s3paths.getBreadCrumbs(path)]
    return R.intersperse(
      Crumb.Sep(<>&nbsp;/ </>),
      segments.map(({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to:
            path === segPath
              ? undefined
              : urls.bucketPackageTree(bucket, name, hashOrTag, segPath),
        }),
      ),
    ).concat(path.endsWith('/') ? Crumb.Sep(<>&nbsp;/</>) : [])
  }, [bucket, name, hashOrTag, path, urls])

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
      {hash ? (
        <ResolverProvider {...{ bucket, name, hash }}>
          {isDir ? (
            <DirDisplay
              {...{
                bucket,
                name,
                hash,
                path,
                hashOrTag,
                crumbs,
                size,
              }}
            />
          ) : (
            <FileDisplayQuery
              {...{ bucket, mode, name, hash, hashOrTag, path, crumbs }}
            />
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
        <PackageTree
          {...{
            bucket,
            name,
            hashOrTag,
            hash: d.package.revision?.hash,
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

const REVISE_PACKAGE_UI = {
  resetFiles: 'Undo changes',
  submit: 'Push',
  successBrowse: 'Browse',
  successTitle: 'Push complete',
  successRenderMessage: ({ packageLink }: { packageLink: React.ReactNode }) => (
    <>Package revision {packageLink} successfully created</>
  ),
  title: 'Push package revision',
}

interface PackageTreeRouteParams {
  bucket: string
  name: string
  revision?: string
  path?: string
}

export default function PackageTreeWrapper({
  match: {
    params: { bucket, name, revision: hashOrTag = 'latest', path: encodedPath = '' },
  },
  location,
}: RRDom.RouteComponentProps<PackageTreeRouteParams>) {
  const path = s3paths.decode(encodedPath)
  // TODO: mode is "switch view mode" action, ex. mode=json, or type=json, or type=application/json
  const { resolvedFrom, mode } = parseSearch(location.search, true)
  return (
    <>
      <MetaTitle>{[`${name}@${R.take(10, hashOrTag)}/${path}`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <CreatePackage.Provider
          {...{ id: 'package', bucket, name, hashOrTag, ui: REVISE_PACKAGE_UI }}
        >
          <PackageTreeQueries
            {...{ bucket, name, hashOrTag, path, resolvedFrom, mode }}
          />
        </CreatePackage.Provider>
      </WithPackagesSupport>
    </>
  )
}
