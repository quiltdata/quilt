import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { Link as RRLink, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import * as Intercom from 'components/Intercom'
import Placeholder from 'components/Placeholder'
import * as Preview from 'components/Preview'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Config from 'utils/Config'
import Data, { useData } from 'utils/Data'
// import * as LinkedData from 'utils/LinkedData'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'
import Link from 'utils/StyledLink'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import usePrevious from 'utils/usePrevious'

import Code from './Code'
import CopyButton from './CopyButton'
import RevisionMenu from './RevisionMenu'
import * as FileView from './FileView'
import Listing from './Listing'
import PackageLink from './PackageLink'
import { usePackageUpdateDialog } from './PackageUpdateDialog'
import PackageCopyDialog from './PackageCopyDialog'
import PackageDeleteDialog from './PackageDeleteDialog'
import RevisionInfo from './RevisionInfo'
import Section from './Section'
import Summary from './Summary'
import * as errors from './errors'
import renderPreview from './renderPreview'
import * as requests from './requests'
import { useViewModes, viewModeToSelectOption } from './viewModes'

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

function PkgCode({ bucket, name, hash, revision, path }) {
  const nameWithPath = JSON.stringify(s3paths.ensureNoSlash(`${name}/${path}`))
  const hashDisplay = revision === 'latest' ? '' : R.take(10, hash)
  const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
  const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
  const code = [
    {
      label: 'Python',
      hl: 'python',
      contents: dedent`
        import quilt3
        # browse
        p = quilt3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")
        # download (be mindful of large packages)
        quilt3.Package.install(${nameWithPath}${hashPy}, registry="s3://${bucket}", dest=".")
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

function TopBar({ crumbs, children }) {
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

function DirDisplay({
  bucket,
  name,
  hash,
  revision,
  path,
  crumbs,
  onRevisionPush,
  onCrossBucketPush,
}) {
  const s3 = AWS.S3.use()
  const { apiGatewayEndpoint: endpoint, noDownload } = Config.use()
  const credentials = AWS.Credentials.use()
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  const intercom = Intercom.use()
  const classes = useDirDisplayStyles()

  const showIntercom = React.useMemo(
    () => (intercom.dummy ? null : () => intercom('show')),
    [intercom],
  )

  const data = useData(requests.packageSelect, {
    s3,
    credentials,
    endpoint,
    bucket,
    name,
    hash,
    prefix: path,
  })

  const mkUrl = React.useCallback(
    (handle) => urls.bucketPackageTree(bucket, name, revision, handle.logicalKey),
    [urls, bucket, name, revision],
  )

  const updateDialog = usePackageUpdateDialog({
    bucket,
    name,
    hash,
    onExited: onRevisionPush,
  })

  const [successor, setSuccessor] = React.useState(null)

  const onPackageCopyDialogExited = React.useCallback(
    (res) => {
      if (res && res.pushed) onCrossBucketPush(res)
      setSuccessor(null)
    },
    [setSuccessor, onCrossBucketPush],
  )

  usePrevious({ bucket, name, revision }, (prev) => {
    // close the dialog when navigating away
    if (!R.equals({ bucket, name, revision }, prev)) updateDialog.close()
  })

  const preferences = BucketPreferences.use()

  const redirectToPackagesList = React.useCallback(() => {
    history.push(urls.bucketPackageList(bucket))
  }, [bucket, history, urls])
  const [deletionState, setDeletionState] = React.useState({
    error: null,
    loading: false,
    opened: false,
  })
  const deleteRevision = requests.useDeleteRevision()
  const onPackageDeleteDialogOpen = React.useCallback(() => {
    setDeletionState(R.assoc('opened', true))
  }, [])
  const onPackageDeleteDialogClose = React.useCallback(() => {
    setDeletionState(
      R.mergeLeft({
        error: null,
        opened: false,
      }),
    )
  }, [])
  const handlePackageDeletion = React.useCallback(async () => {
    setDeletionState(R.assoc('loading', true))

    try {
      await deleteRevision({ source: { bucket, name, hash } })
      setDeletionState(R.mergeLeft({ opened: false, loading: false }))
      redirectToPackagesList()
    } catch (error) {
      setDeletionState(R.mergeLeft({ error, loading: false }))
    }
  }, [bucket, hash, name, deleteRevision, redirectToPackagesList, setDeletionState])

  const packageHandle = React.useMemo(
    () => ({
      bucket,
      hash,
      name,
      revision,
      path,
    }),
    [bucket, hash, name, revision, path],
  )

  return data.case({
    Ok: ({ objects, prefixes, meta }) => {
      const up =
        path === ''
          ? []
          : [
              {
                type: 'dir',
                name: '..',
                to: urls.bucketPackageTree(bucket, name, revision, s3paths.up(path)),
              },
            ]
      const dirs = prefixes.map((p) => ({
        type: 'dir',
        name: s3paths.ensureNoSlash(p),
        to: urls.bucketPackageTree(bucket, name, revision, path + p),
      }))
      const files = objects.map((o) => ({
        type: 'file',
        name: o.name,
        to: urls.bucketPackageTree(bucket, name, revision, path + o.name),
        size: o.size,
      }))
      const items = [...up, ...dirs, ...files]
      const summaryHandles = objects.map((o) => ({
        ...s3paths.parseS3Url(o.physicalKey),
        logicalKey: path + o.name,
      }))

      const downloadPath = path
        ? `package/${bucket}/${name}/${hash}/${path}`
        : `package/${bucket}/${name}/${hash}`

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

          <PackageDeleteDialog
            error={deletionState.error}
            open={deletionState.opened}
            packageHandle={packageHandle}
            onClose={onPackageDeleteDialogClose}
            loading={deletionState.loading}
            onDelete={handlePackageDeletion}
          />

          {updateDialog.element}

          <TopBar crumbs={crumbs}>
            {preferences?.ui?.actions?.revisePackage && (
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
            {!noDownload && (
              <FileView.ZipDownloadForm
                className={classes.button}
                label={path ? 'Download sub-package' : 'Download package'}
                suffix={downloadPath}
              />
            )}
            {preferences?.ui?.actions?.deleteRevision && (
              <RevisionMenu
                className={classes.button}
                onDelete={onPackageDeleteDialogOpen}
              />
            )}
          </TopBar>
          <PkgCode {...packageHandle} />
          <FileView.Meta data={AsyncResult.Ok(meta)} />
          <M.Box mt={2}>
            <Listing items={items} />
            <Summary files={summaryHandles} mkUrl={mkUrl} packageHandle={packageHandle} />
          </M.Box>
        </>
      )
    },
    Err: (e) => {
      let heading = 'Error loading directory'
      let body = "Seems like there's no such directory in this package"
      if (e.status === 500 && /Could not reserve memory block/.test(e.message)) {
        heading = 'Oops, this is a large package'
        body = (
          <>
            The Lambda process ran out of memory
            {!!showIntercom && (
              <>
                , but don&apos;t worry,{' '}
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <Link component="span" role="button" onClick={showIntercom}>
                  we can fix it
                </Link>
              </>
            )}
            .
          </>
        )
      }
      return (
        <>
          <TopBar crumbs={crumbs} />
          <M.Box mt={4}>
            <M.Typography variant="h4" align="center" gutterBottom>
              {heading}
            </M.Typography>
            <M.Typography variant="body1" align="center">
              {body}
            </M.Typography>
          </M.Box>
        </>
      )
    },
    _: () => (
      // TODO: skeleton placeholder
      <>
        <TopBar crumbs={crumbs} />
        <M.Box mt={2}>
          <M.CircularProgress />
        </M.Box>
      </>
    ),
  })
}

const withPreview = ({ archived, deleted, handle, mode, packageHandle }, callback) => {
  if (deleted) {
    return callback(AsyncResult.Err(Preview.PreviewError.Deleted({ handle })))
  }
  if (archived) {
    return callback(AsyncResult.Err(Preview.PreviewError.Archived({ handle })))
  }
  return Preview.load({ ...handle, mode, packageHandle }, callback)
}

const useFileDisplayStyles = M.makeStyles((t) => ({
  button: {
    marginLeft: t.spacing(2),
  },
}))

function FileDisplay({ bucket, mode, name, hash, revision, path, crumbs }) {
  const s3 = AWS.S3.use()
  const credentials = AWS.Credentials.use()
  const { apiGatewayEndpoint: endpoint, noDownload } = Config.use()
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  const classes = useFileDisplayStyles()

  const data = useData(requests.packageFileDetail, {
    s3,
    credentials,
    endpoint,
    bucket,
    name,
    hash,
    path,
  })

  const packageHandle = React.useMemo(
    () => ({ bucket, name, hash, revision, path }),
    [bucket, name, hash, revision, path],
  )

  const viewModes = useViewModes(path, mode, packageHandle)

  const onViewModeChange = React.useCallback(
    (m) => {
      history.push(urls.bucketPackageTree(bucket, name, revision, path, m.valueOf()))
    },
    [bucket, history, name, path, revision, urls],
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

  const renderError = (headline, detail) => (
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

  return data.case({
    Ok: ({ meta, ...handle }) => (
      <Data fetch={requests.getObjectExistence} params={{ s3, ...handle }}>
        {AsyncResult.case({
          _: renderProgress,
          Err: (e) => {
            if (e.code === 'Forbidden') {
              return renderError('Access Denied', "You don't have access to this object")
            }
            // eslint-disable-next-line no-console
            console.error(e)
            return renderError('Error loading file', 'Something went wrong')
          },
          Ok: requests.ObjectExistence.case({
            Exists: ({ archived, deleted }) => (
              <>
                <TopBar crumbs={crumbs}>
                  {!!viewModes.modes.length && (
                    <FileView.ViewModeSelector
                      className={classes.button}
                      options={viewModes.modes.map(viewModeToSelectOption)}
                      value={viewModeToSelectOption(viewModes.mode)}
                      onChange={onViewModeChange}
                    />
                  )}
                  {!noDownload && !deleted && !archived && (
                    <FileView.DownloadButton className={classes.button} handle={handle} />
                  )}
                </TopBar>
                <PkgCode {...packageHandle} />
                <FileView.Meta data={AsyncResult.Ok(meta)} />
                <Section icon="remove_red_eye" heading="Preview" expandable={false}>
                  {withPreview(
                    { archived, deleted, handle, mode: viewModes.mode, packageHandle },
                    renderPreview(viewModes.handlePreviewResult),
                  )}
                </Section>
              </>
            ),
            _: () => renderError('No Such Object'),
          }),
        })}
      </Data>
    ),
    Err: (e) => {
      // eslint-disable-next-line no-console
      console.error(e)
      return renderError(
        'Error loading file',
        "Seems like there's no such file in this package",
      )
    },
    _: renderProgress,
  })
}

function ResolverProvider({ bucket, name, hash, children }) {
  const s3 = AWS.S3.use()
  const { apiGatewayEndpoint: endpoint } = Config.use()
  const credentials = AWS.Credentials.use()

  // XXX: consider optimization: check current level (objects) for quick response
  // const found = objects.find((o) => o.name === logicalKey)
  // if (found) return s3paths.parseS3Url(found.physicalKey)
  const resolveLogicalKey = React.useMemo(
    () => (logicalKey) =>
      requests.packageFileDetail({
        s3,
        credentials,
        endpoint,
        bucket,
        name,
        hash,
        path: logicalKey,
      }),
    [s3, credentials, endpoint, bucket, name, hash],
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

function PackageTree({ bucket, mode, name, revision, path, resolvedFrom }) {
  const classes = useStyles()
  const s3 = AWS.S3.use()
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
              : urls.bucketPackageTree(bucket, name, revision, segPath),
        }),
      ),
    ).concat(path.endsWith('/') ? Crumb.Sep(<>&nbsp;/</>) : [])
  }, [bucket, name, revision, path, urls])

  const [revisionKey, setRevisionKey] = React.useState(1)
  const [revisionListKey, setRevisionListKey] = React.useState(1)

  const onRevisionPush = React.useCallback(
    (res) => {
      const pushedSamePackage = R.pathEq(['pushed', 'name'], name, res)
      if (pushedSamePackage) {
        // refresh revision list if a new revision of the current package has been pushed
        setRevisionListKey(R.inc)
        if (revision === 'latest') {
          // when browsing 'latest' revision, also refresh the package view
          setRevisionKey(R.inc)
        }
      }
    },
    [name, revision, setRevisionKey, setRevisionListKey],
  )

  const onCrossBucketPush = React.useCallback(() => {
    setRevisionKey(R.inc)
  }, [setRevisionKey])

  const revisionData = useData(requests.resolvePackageRevision, {
    s3,
    bucket,
    name,
    revision,
    revisionKey,
  })

  return (
    <FileView.Root>
      <MetaTitle>{[`${name}@${R.take(10, revision)}/${path}`, bucket]}</MetaTitle>
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
                component={RRLink}
                to={urls.bucketPackageTree(bucket, name, revision, path)}
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
        <PackageLink
          {...{ bucket, name, path, revision, revisionListKey, revisionData }}
        />
        {' @ '}
        <RevisionInfo
          {...{ revisionData, revision, bucket, name, path }}
          key={`revinfo:${revisionListKey}`}
        />
      </M.Typography>
      {revisionData.case({
        Ok: ({ hash }) => (
          <ResolverProvider {...{ bucket, name, hash }}>
            {isDir ? (
              <DirDisplay
                {...{
                  bucket,
                  name,
                  hash,
                  path,
                  revision,
                  crumbs,
                  onRevisionPush,
                  onCrossBucketPush,
                  key: hash,
                }}
              />
            ) : (
              <FileDisplay {...{ bucket, mode, name, hash, revision, path, crumbs }} />
            )}
          </ResolverProvider>
        ),
        Err: (e) => {
          if (!(e instanceof errors.BadRevision)) throw e
          return (
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
                  >{`"${e.revision}"`}</M.Box>{' '}
                  could not be resolved.
                </M.Typography>
              </M.Box>
            </>
          )
        },
        _: () => (
          // TODO: skeleton placeholder
          <>
            <TopBar crumbs={crumbs} />
            <M.Box mt={2}>
              <M.CircularProgress />
            </M.Box>
          </>
        ),
      })}
    </FileView.Root>
  )
}

export default function PackageTreeWrapper({
  match: {
    params: { bucket, name, revision = 'latest', path: encodedPath = '' },
  },
  location,
}) {
  const path = s3paths.decode(encodedPath)
  const { resolvedFrom, mode } = parseSearch(location.search)
  const s3 = AWS.S3.use()
  const packageExists = useData(requests.ensurePackageExists, { s3, bucket, name })
  return packageExists.case({
    Ok: () => <PackageTree {...{ bucket, mode, name, revision, path, resolvedFrom }} />,
    Err: errors.displayError(),
    _: () => <Placeholder color="text.secondary" />,
  })
}
