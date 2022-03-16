import { basename } from 'path'

import * as dateFns from 'date-fns'
import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import Message from 'components/Message'
import * as Preview from 'components/Preview'
import Sparkline from 'components/Sparkline'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'

import Code from 'containers/Bucket/Code'
import FileProperties from 'containers/Bucket/FileProperties'
import * as FileView from 'containers/Bucket/FileView'
import Section from 'containers/Bucket/Section'
import renderPreview from 'containers/Bucket/renderPreview'
import * as requests from 'containers/Bucket/requests'

import * as EmbedConfig from './EmbedConfig'
import * as Overrides from './Overrides'
import getCrumbs from './getCrumbs'
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
  const cfg = Config.use()
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
      url: urls.bucketFile(bucket, path, v.id),
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
        url: urls.bucketFile(bucket, path, v.id),
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
                  to={urls.bucketFile(bucket, path, v.id)}
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

function Meta({ bucket, path, version }) {
  const s3 = AWS.S3.use()
  const data = useData(requests.objectMeta, { s3, bucket, path, version })
  return <FileView.Meta data={data.result} />
}

function Analytics({ analyticsBucket, bucket, path }) {
  const [cursor, setCursor] = React.useState(null)
  const s3 = AWS.S3.use()
  const today = React.useMemo(() => new Date(), [])
  const formatDate = (date) =>
    dateFns.format(
      date,
      today.getFullYear() === date.getFullYear() ? 'd MMM' : 'd MMM yyyy',
    )
  const data = useData(requests.objectAccessCounts, {
    s3,
    analyticsBucket,
    bucket,
    path,
    today,
  })

  const defaultExpanded = data.case({
    Ok: ({ total }) => !!total,
    _: () => false,
  })

  return (
    <Section icon="bar_charts" heading="Analytics" defaultExpanded={defaultExpanded}>
      {data.case({
        Ok: ({ counts, total }) =>
          total ? (
            <M.Box
              display="flex"
              width="100%"
              justifyContent="space-between"
              alignItems="center"
            >
              <M.Box>
                <M.Typography variant="h5">Downloads</M.Typography>
                <M.Typography variant="h4" component="div">
                  {readableQuantity(cursor === null ? total : counts[cursor].value)}
                </M.Typography>
                <M.Typography variant="overline" component="span">
                  {cursor === null
                    ? `${counts.length} days`
                    : formatDate(counts[cursor].date)}
                </M.Typography>
              </M.Box>
              <M.Box width="calc(100% - 7rem)">
                <Sparkline
                  data={R.pluck('value', counts)}
                  onCursor={setCursor}
                  width={1000}
                  height={60}
                  stroke={SVG.Paint.Server(
                    <linearGradient x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor={M.colors.blueGrey[800]} />
                      <stop offset="100%" stopColor={M.colors.blueGrey[100]} />
                    </linearGradient>,
                  )}
                />
              </M.Box>
            </M.Box>
          ) : (
            <M.Typography>No analytics available</M.Typography>
          ),
        Err: () => <M.Typography>No analytics available</M.Typography>,
        _: () => <M.CircularProgress />,
      })}
    </Section>
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
}))

const previewOptions = { context: Preview.CONTEXT.FILE }

export default function File({
  match: {
    params: { bucket, path: encodedPath },
  },
  location,
}) {
  const cfg = EmbedConfig.use()
  const { version } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { analyticsBucket, noDownload } = Config.use()
  const s3 = AWS.S3.use()

  const path = s3paths.decode(encodedPath)

  const code = React.useMemo(
    () => [
      {
        label: 'Python',
        hl: 'python',
        contents: dedent`
          import quilt3
          b = quilt3.Bucket("s3://${bucket}")
          b.fetch("${path}", "./${basename(path)}")
        `,
      },
      {
        label: 'CLI',
        hl: 'bash',
        contents: dedent`
          aws s3 cp "s3://${bucket}/${path}" .
        `,
      },
    ],
    [bucket, path],
  )

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
    !noDownload &&
    versionExistsData.case({
      _: () => false,
      Ok: requests.ObjectExistence.case({
        _: () => false,
        Exists: ({ deleted, archived }) => !deleted && !archived,
      }),
    })

  const handle = { bucket, key: path, version }

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

  return (
    <FileView.Root>
      <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
        {renderCrumbs(
          getCrumbs({ bucket, path, urls, scope: cfg.scope, excludeBase: true }),
        )}
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
            <FileView.DownloadButton className={classes.button} handle={handle} />
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
              {!cfg.hideCode && <Code>{code}</Code>}
              {!cfg.hideAnalytics && !!analyticsBucket && (
                <Analytics {...{ analyticsBucket, bucket, path }} />
              )}
              <Section icon="remove_red_eye" heading="Preview" defaultExpanded>
                {versionExistsData.case({
                  _: () => <CenteredProgress />,
                  Err: (e) => {
                    throw e
                  },
                  Ok: withPreview(renderPreview()),
                })}
              </Section>
              <Meta bucket={bucket} path={path} version={version} />
            </>
          ),
          _: () => <Message headline="No Such Object" />,
        }),
      })}
    </FileView.Root>
  )
}
