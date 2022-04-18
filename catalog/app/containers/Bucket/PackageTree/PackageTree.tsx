import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as urql from 'urql'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import Message from 'components/Message'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
// import * as LinkedData from 'utils/LinkedData'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'
import assertNever from 'utils/assertNever'
import { PackageHandle } from 'utils/packageHandle'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import usePrevious from 'utils/usePrevious'
import { UseQueryResult, useQuery } from 'utils/useQuery'
import * as workflows from 'utils/workflows'

import Code from '../Code'
import CopyButton from '../CopyButton'
import * as Download from '../Download'
import { FileProperties } from '../FileProperties'
import * as FileView from '../FileView'
import Listing, { Item as ListingItem } from '../Listing'
import PackageCopyDialog from '../PackageCopyDialog'
import * as PD from '../PackageDialog'
import Section from '../Section'
import Summary from '../Summary'
import WithPackagesSupport from '../WithPackagesSupport'
import * as errors from '../errors'
import renderPreview from '../renderPreview'
import * as requests from '../requests'
import { ViewMode, useViewModes, viewModeToSelectOption } from '../viewModes'
import PackageLink from './PackageLink'
import RevisionDeleteDialog from './RevisionDeleteDialog'
import RevisionInfo from './RevisionInfo'
import RevisionMenu from './RevisionMenu'

import REVISION_QUERY from './gql/Revision.generated'
import REVISION_LIST_QUERY from './gql/RevisionList.generated'
import DIR_QUERY from './gql/Dir.generated'
import FILE_QUERY from './gql/File.generated'
import DELETE_REVISION from './gql/DeleteRevision.generated'

/*
function ExposeLinkedData({ bucketCfg, bucket, name, hash, modified }) {
  const sign = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint: endpoint } = Config.use()
  const data = useData(requests.getRevisionData, {
    sign,
    endpoint,
    bucket,
    hash,
    maxKeys: 0,
  })
  return data.case({
    _: () => null,
    Ok: ({ header }) => (
      <React.Suspense fallback={null}>
        <LinkedData.PackageData
          {...{ bucket: bucketCfg, name, hash, modified, header }}
        />
      </React.Suspense>
    ),
  })
}
*/

interface PkgCodeProps {
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
}

function PkgCode({ bucket, name, hash, hashOrTag, path }: PkgCodeProps) {
  const nameWithPath = JSON.stringify(s3paths.ensureNoSlash(`${name}/${path}`))
  const hashDisplay = hashOrTag === 'latest' ? '' : R.take(10, hash)
  const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
  const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
  const code = [
    {
      label: 'Python',
      hl: 'python',
      contents: dedent`
        import quilt3 as q3
        # browse
        p = q3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")
        # download (be mindful of large packages)
        q3.Package.install(${nameWithPath}${hashPy}, registry="s3://${bucket}", dest=".")
      `,
    },
    {
      label: 'CLI',
      hl: 'bash',
      contents: dedent`
        quilt3 install ${nameWithPath}${hashCli} --registry s3://${bucket} --dest .
      `,
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
  spacer: {
    flexGrow: 1,
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
      <div className={classes.spacer} />
      {children}
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
}

function DirDisplay({ bucket, name, hash, hashOrTag, path, crumbs }: DirDisplayProps) {
  const { desktop } = Config.use()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const classes = useDirDisplayStyles()

  const dirQuery = useQuery({
    query: DIR_QUERY,
    variables: { bucket, name, hash, path: s3paths.ensureNoSlash(path) },
  })

  const mkUrl = React.useCallback(
    (handle) => urls.bucketPackageTree(bucket, name, hashOrTag, handle.logicalKey),
    [urls, bucket, name, hashOrTag],
  )

  const updateDialog = PD.usePackageCreationDialog({
    bucket,
    src: { name, hash },
  })

  const [successor, setSuccessor] = React.useState<workflows.Successor | null>(null)

  const onPackageCopyDialogExited = React.useCallback(() => {
    setSuccessor(null)
  }, [setSuccessor])

  usePrevious({ bucket, name, hashOrTag }, (prev) => {
    // close the dialog when navigating away
    if (!R.equals({ bucket, name, hashOrTag }, prev)) updateDialog.close()
  })

  const preferences = BucketPreferences.use()

  const redirectToPackagesList = React.useCallback(() => {
    history.push(urls.bucketPackageList(bucket))
  }, [bucket, history, urls])

  const [deletionState, setDeletionState] = React.useState({
    error: undefined as React.ReactNode | undefined,
    loading: false,
    opened: false,
  })

  const onPackageDeleteDialogOpen = React.useCallback(() => {
    setDeletionState(R.assoc('opened', true))
  }, [])

  const onPackageDeleteDialogClose = React.useCallback(() => {
    setDeletionState(
      R.mergeLeft({
        error: undefined,
        opened: false,
      }),
    )
  }, [])

  const [, deleteRevision] = urql.useMutation(DELETE_REVISION)

  const handlePackageDeletion = React.useCallback(async () => {
    setDeletionState(R.assoc('loading', true))
    try {
      const res = await deleteRevision({ bucket, name, hash })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data returned by the API')
      const r = res.data.packageRevisionDelete
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

  const [expandedLocalFolder, setExpandedLocalFolder] = React.useState(false)
  const [localFolder, setLocalFolder] = Download.useLocalFolder()

  return (
    <>
      <PackageCopyDialog
        bucket={bucket}
        hash={hash}
        name={name}
        open={!!successor}
        successor={successor}
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

      <Download.ConfirmDialog
        localPath={localFolder}
        onClose={() => setExpandedLocalFolder(false)}
        open={!!localFolder && !!expandedLocalFolder}
        packageHandle={packageHandle}
      />

      {dirQuery.case({
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

          return (
            <>
              <TopBar crumbs={crumbs}>
                {preferences?.ui?.actions?.revisePackage && !desktop && (
                  <M.Button
                    className={classes.button}
                    variant="contained"
                    color="primary"
                    size="small"
                    style={{ marginTop: -3, marginBottom: -3, flexShrink: 0 }}
                    onClick={updateDialog.open}
                  >
                    Revise package
                  </M.Button>
                )}
                {preferences?.ui?.actions?.copyPackage && (
                  <CopyButton
                    className={classes.button}
                    bucket={bucket}
                    onChange={setSuccessor}
                  >
                    Push to bucket
                  </CopyButton>
                )}
                <Download.DownloadButton
                  className={classes.button}
                  label={path ? 'Download sub-package' : 'Download package'}
                  onClick={() => setExpandedLocalFolder(true)}
                  path={downloadPath}
                />
                {preferences?.ui?.actions?.deleteRevision && (
                  <RevisionMenu
                    className={classes.button}
                    onDelete={onPackageDeleteDialogOpen}
                  />
                )}
              </TopBar>
              {preferences?.ui?.blocks?.code && (
                <PkgCode {...{ ...packageHandle, hashOrTag, path }} />
              )}
              {desktop && (
                <Download.LocalFolderInput
                  onChange={setLocalFolder}
                  open={expandedLocalFolder}
                  value={localFolder}
                />
              )}
              {preferences?.ui?.blocks?.meta && (
                <FileView.Meta data={AsyncResult.Ok(dir.metadata)} />
              )}
              <M.Box mt={2}>
                {preferences?.ui?.blocks?.browser && <Listing items={items} key={hash} />}
                <Summary
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
  handle: PackageEntryHandle,
  mode: ViewMode | null,
  packageHandle: PackageHandle,
  callback: (res: $TSFixMe) => JSX.Element,
) => {
  if (deleted) {
    return callback(AsyncResult.Err(Preview.PreviewError.Deleted({ handle })))
  }
  if (archived) {
    return callback(AsyncResult.Err(Preview.PreviewError.Archived({ handle })))
  }
  const previewHandle = { ...handle, packageHandle }
  const previewOptions = { mode, context: Preview.CONTEXT.FILE }
  return Preview.load(previewHandle, callback, previewOptions)
}

interface ObjectAttrs {
  archived: boolean
  deleted: boolean
  lastModified?: Date
  size?: number
}

interface PackageEntryHandle extends s3paths.S3HandleBase {
  logicalKey: string
}

const useFileDisplayStyles = M.makeStyles((t) => ({
  button: {
    marginLeft: t.spacing(2),
  },
  fileProperties: {
    [t.breakpoints.up('sm')]: {
      marginBottom: '3px',
    },
  },
}))

interface FileDisplayProps {
  bucket: string
  name: string
  hash: string
  hashOrTag: string
  path: string
  crumbs: $TSFixMe[] // Crumb
  mode?: string
}

function FileDisplay({
  bucket,
  mode,
  name,
  hash,
  hashOrTag,
  path,
  crumbs,
}: FileDisplayProps) {
  const s3 = AWS.S3.use()
  const { noDownload } = Config.use()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const classes = useFileDisplayStyles()
  const preferences = BucketPreferences.use()

  const fileQuery = useQuery({
    query: FILE_QUERY,
    variables: { bucket, name, hash, path },
  })

  const packageHandle = React.useMemo(
    () => ({ bucket, name, hash }),
    [bucket, name, hash],
  )

  const viewModes = useViewModes(path, mode, packageHandle)

  const onViewModeChange = React.useCallback(
    (m) => {
      history.push(urls.bucketPackageTree(bucket, name, hashOrTag, path, m.valueOf()))
    },
    [bucket, history, name, path, hashOrTag, urls],
  )

  const renderProgress = () => (
    // TODO: skeleton placeholder
    <>
      <TopBar crumbs={crumbs} />
      <M.Box mt={2}>
        <M.CircularProgress />
      </M.Box>
    </>
  )

  const renderError = (headline: React.ReactNode, detail?: React.ReactNode) => (
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

  return fileQuery.case({
    fetching: renderProgress,
    data: (d) => {
      const file = d.package?.revision?.file

      if (!file) {
        // eslint-disable-next-line no-console
        if (fileQuery.error) console.error(fileQuery.error)
        return renderError(
          'Error loading file',
          "Seems like there's no such file in this package",
        )
      }

      const handle: PackageEntryHandle = {
        ...s3paths.parseS3Url(file.physicalKey),
        logicalKey: file.path,
      }

      return (
        // @ts-expect-error
        <Data fetch={requests.getObjectExistence} params={{ s3, ...handle }}>
          {AsyncResult.case({
            _: renderProgress,
            Err: (e: $TSFixMe) => {
              if (e.code === 'Forbidden') {
                return renderError(
                  'Access Denied',
                  "You don't have access to this object",
                )
              }
              // eslint-disable-next-line no-console
              console.error(e)
              return renderError('Error loading file', 'Something went wrong')
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
                    {!noDownload && !deleted && !archived && (
                      <FileView.DownloadButton
                        className={classes.button}
                        handle={handle}
                      />
                    )}
                  </TopBar>
                  {preferences?.ui?.blocks?.code && (
                    <PkgCode {...{ ...packageHandle, hashOrTag, path }} />
                  )}
                  {preferences?.ui?.blocks?.meta && (
                    <FileView.Meta data={AsyncResult.Ok(file.metadata)} />
                  )}
                  <Section icon="remove_red_eye" heading="Preview" expandable={false}>
                    {withPreview(
                      { archived, deleted },
                      handle,
                      viewModes.mode,
                      packageHandle,
                      renderPreview(viewModes.handlePreviewResult),
                    )}
                  </Section>
                </>
              ),
              _: () => renderError('No Such Object'),
            }),
          })}
        </Data>
      )
    },
  })
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
  revisionListQuery: UseQueryResult<ResultOf<typeof REVISION_LIST_QUERY>>
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
}: PackageTreeProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  // TODO: use urql to get bucket config
  // const [{ data }] = urql.useQuery({
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
              }}
            />
          ) : (
            <FileDisplay {...{ bucket, mode, name, hash, hashOrTag, path, crumbs }} />
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
  const revisionQuery = useQuery({
    query: REVISION_QUERY,
    variables: { bucket, name, hashOrTag },
  })

  const revisionListQuery = useQuery({
    query: REVISION_LIST_QUERY,
    variables: { bucket, name },
  })

  return revisionQuery.case({
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
    params: { bucket, name, revision: hashOrTag = 'latest', path: encodedPath = '' },
  },
  location,
}: RRDom.RouteComponentProps<PackageTreeRouteParams>) {
  const path = s3paths.decode(encodedPath)
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
