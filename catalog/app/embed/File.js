import { basename } from 'path'

import * as React from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import Message from 'components/Message'
import * as Preview from 'components/Preview'
import cfg from 'constants/config'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'

import Analytics from 'containers/Bucket/File/Analytics'
import * as Download from 'containers/Bucket/Download'
import FileProperties from 'containers/Bucket/FileProperties'
import * as FileView from 'containers/Bucket/FileView'
import Section from 'containers/Bucket/Section'
import renderPreview from 'containers/Bucket/renderPreview'
import * as requests from 'containers/Bucket/requests'

import * as EmbedConfig from './EmbedConfig'
import * as Overrides from './Overrides'
import * as ipc from './ipc'

const defaults = {
  s3ObjectLink: {
    title: "Copy object version's canonical HTTPS URI to the clipboard",
    href: (ctx) => ctx.s3HttpsUri,
    notification: 'HTTPS URI copied to clipboard',
  },
}

const useVersionInfoStyles = M.makeStyles(({ typography }) => ({
  version: {
    ...linkStyle,
    alignItems: 'center',
    display: 'inline-flex',
  },
  mono: {
    fontFamily: typography.monospace.fontFamily,
  },
  list: {
    maxWidth: '100%',
    width: 420,
  },
}))

function VersionInfo({ bucket, path, version }) {
  const s3 = AWS.S3.use()
  const { urls } = NamedRoutes.use()
  const { push } = Notifications.use()
  const messageParent = ipc.useMessageParent()

  const containerRef = React.useRef()
  const [anchor, setAnchor] = React.useState()
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  const overrides = Overrides.use(defaults)

  const classes = useVersionInfoStyles()

  const getLink = (v) =>
    overrides.s3ObjectLink.href({
      url: urls.bucketFile(bucket, path, { version: v.id }),
      s3HttpsUri: s3paths.handleToHttpsUri({ bucket, key: path, version: v.id }),
      bucket,
      key: path,
      version: v.id,
    })

  const getCliArgs = (v) => `--bucket ${bucket} --key "${path}" --version-id ${v.id}`

  const copyLink = (v) => (e) => {
    e.preventDefault()
    if (overrides.s3ObjectLink.emit !== 'override') {
      copyToClipboard(getLink(v), { container: containerRef.current })
      push(overrides.s3ObjectLink.notification)
    }
    if (overrides.s3ObjectLink.emit) {
      messageParent({
        type: 's3ObjectLink',
        url: urls.bucketFile(bucket, path, { version: v.id }),
        s3HttpsUri: s3paths.handleToHttpsUri({ bucket, key: path, version: v.id }),
        bucket,
        key: path,
        version: v.id,
      })
    }
  }

  const copyCliArgs = (v) => (e) => {
    e.preventDefault()
    copyToClipboard(getCliArgs(v), { container: containerRef.current })
    push('Object location copied to clipboard')
  }

  const data = useData(requests.objectVersions, { s3, bucket, path })

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span className={classes.version} onClick={open} ref={setAnchor}>
        {version ? (
          <span className={classes.mono}>{version.substring(0, 12)}</span>
        ) : (
          'latest'
        )}{' '}
        <M.Icon>expand_more</M.Icon>
      </span>
      <M.Popover
        open={opened && !!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {data.case({
          Ok: (versions) => (
            <M.List className={classes.list} ref={containerRef}>
              {versions.map((v) => (
                <M.ListItem
                  key={v.id}
                  button
                  onClick={close}
                  selected={version ? v.id === version : v.isLatest}
                  component={Link}
                  to={urls.bucketFile(bucket, path, { version: v.id })}
                >
                  <M.ListItemText
                    primary={
                      <span>
                        <Format.Relative value={v.lastModified} />
                        {v.isLatest && ' (latest)'}
                        {' | '}
                        {v.size != null ? readableBytes(v.size) : 'Delete Marker'}
                      </span>
                    }
                    secondary={
                      <span>
                        {v.lastModified.toLocaleString()}
                        <br />
                        <span className={classes.mono}>{v.id}</span>
                      </span>
                    }
                  />
                  {!cfg.noDownload && (
                    <M.ListItemSecondaryAction>
                      {!v.deleteMarker &&
                        !v.archived &&
                        AWS.Signer.withDownloadUrl(
                          { bucket, key: path, version: v.id },
                          (url) => (
                            <M.IconButton
                              href={url}
                              title="Download this version of the object"
                            >
                              <M.Icon>arrow_downward</M.Icon>
                            </M.IconButton>
                          ),
                        )}
                      <M.Hidden xsDown>
                        <M.IconButton
                          title={overrides.s3ObjectLink.title}
                          href={getLink(v)}
                          onClick={copyLink(v)}
                        >
                          <M.Icon>link</M.Icon>
                        </M.IconButton>
                        <M.IconButton
                          title="Copy object location in CLI format (aws s3api) to the clipboard"
                          onClick={copyCliArgs(v)}
                        >
                          <M.Box
                            fontSize={20}
                            height={24}
                            width={24}
                            lineHeight={24 / 20}
                            display="flex"
                            justifyContent="center"
                          >
                            S3
                          </M.Box>
                        </M.IconButton>
                      </M.Hidden>
                    </M.ListItemSecondaryAction>
                  )}
                </M.ListItem>
              ))}
            </M.List>
          ),
          Err: () => (
            <M.List>
              <M.ListItem>
                <M.ListItemIcon>
                  <M.Icon>error</M.Icon>
                </M.ListItemIcon>
                <M.Typography variant="body1">Error fetching versions</M.Typography>
              </M.ListItem>
            </M.List>
          ),
          _: () => (
            <M.List>
              <M.ListItem>
                <M.ListItemIcon>
                  <M.CircularProgress size={24} />
                </M.ListItemIcon>
                <M.Typography variant="body1">Fetching versions</M.Typography>
              </M.ListItem>
            </M.List>
          ),
        })}
      </M.Popover>
    </>
  )
}

function CenteredProgress() {
  return (
    <M.Box textAlign="center" width="100%">
      <M.CircularProgress />
    </M.Box>
  )
}

const useStyles = M.makeStyles((t) => ({
  crumbs: {
    ...t.typography.body1,
    maxWidth: '100%',
    overflowWrap: 'break-word',
  },
  name: {
    ...t.typography.body1,
    maxWidth: 'calc(100% - 160px)',
    overflowWrap: 'break-word',
    [t.breakpoints.down('xs')]: {
      maxWidth: 'calc(100% - 40px)',
    },
  },
  topBar: {
    alignItems: 'flex-end',
    display: 'flex',
    marginBottom: t.spacing(2),
  },
  at: {
    color: t.palette.text.secondary,
  },
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: 'auto',
  },
  button: {
    marginLeft: t.spacing(2),
  },
  preview: {
    width: '100%',
  },
}))

const previewOptions = { context: Preview.CONTEXT.FILE }

export default function File() {
  const { bucket, path: encodedPath } = useParams()
  const location = useLocation()
  const ecfg = EmbedConfig.use()
  const { version } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const s3 = AWS.S3.use()

  const path = s3paths.decode(encodedPath)

  const objExistsData = useData(requests.getObjectExistence, { s3, bucket, key: path })
  const versionExistsData = useData(requests.getObjectExistence, {
    s3,
    bucket,
    key: path,
    version,
  })

  const objExists = objExistsData.case({
    _: () => false,
    Ok: requests.ObjectExistence.case({
      Exists: () => true,
      _: () => false,
    }),
  })

  const downloadable =
    !cfg.noDownload &&
    versionExistsData.case({
      _: () => false,
      Ok: requests.ObjectExistence.case({
        _: () => false,
        Exists: ({ deleted, archived }) => !deleted && !archived,
      }),
    })

  const handle = React.useMemo(
    () => ({ bucket, key: path, version }),
    [bucket, path, version],
  )

  const withPreview = (callback) =>
    requests.ObjectExistence.case({
      Exists: (h) => {
        if (h.deleted) {
          return callback(AsyncResult.Err(Preview.PreviewError.Deleted({ handle })))
        }
        if (h.archived) {
          return callback(AsyncResult.Err(Preview.PreviewError.Archived({ handle })))
        }
        return Preview.load(handle, callback, previewOptions)
      },
      DoesNotExist: () =>
        callback(AsyncResult.Err(Preview.PreviewError.InvalidVersion({ handle }))),
    })

  const scoped = ecfg.scope && path.startsWith(ecfg.scope)
  const scopedPath = scoped ? path.substring(ecfg.scope.length) : path
  const getSegmentRoute = React.useCallback(
    (segPath) => urls.bucketDir(bucket, `${scoped ? ecfg.scope : ''}${segPath}`),
    [bucket, ecfg.scope, scoped, urls],
  )
  const crumbs = BreadCrumbs.use(
    s3paths.up(scopedPath),
    getSegmentRoute,
    scoped ? basename(ecfg.scope) : 'ROOT',
    { tailLink: true, tailSeparator: true },
  )

  return (
    <FileView.Root>
      <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
        {BreadCrumbs.render(crumbs)}
      </div>
      <div className={classes.topBar}>
        <div className={classes.name}>
          {basename(path)} <span className={classes.at}>@</span>
          &nbsp;
          {objExists ? ( // eslint-disable-line no-nested-ternary
            <VersionInfo bucket={bucket} path={path} version={version} />
          ) : version ? (
            <M.Box component="span" fontFamily="monospace.fontFamily">
              {version.substring(0, 12)}
            </M.Box>
          ) : (
            'latest'
          )}
        </div>
        <div className={classes.actions}>
          <FileProperties data={versionExistsData} />
          {downloadable && (
            <Download.Button className={classes.button} label="Get file">
              <Download.BucketOptions handle={handle} hideCode={!ecfg.hideCode} />
            </Download.Button>
          )}
        </div>
      </div>
      {objExistsData.case({
        _: () => <CenteredProgress />,
        Err: (e) => {
          if (e.code === 'Forbidden') {
            return (
              <Message headline="Access Denied">
                You don&apos;t have access to this object.
              </Message>
            )
          }
          // TODO: handle this more gracefully
          throw e
        },
        Ok: requests.ObjectExistence.case({
          Exists: () => (
            <>
              {!ecfg.hideAnalytics && !!cfg.analyticsBucket && (
                <Analytics {...{ bucket, path }} />
              )}
              <Section icon="remove_red_eye" heading="Preview" defaultExpanded>
                <div className={classes.preview}>
                  {versionExistsData.case({
                    _: () => <CenteredProgress />,
                    Err: (e) => {
                      throw e
                    },
                    Ok: withPreview(renderPreview()),
                  })}
                </div>
              </Section>
              <FileView.ObjectMeta handle={handle} />
              <FileView.ObjectTags handle={handle} />
            </>
          ),
          _: () => <Message headline="No Such Object" />,
        }),
      })}
    </FileView.Root>
  )
}
