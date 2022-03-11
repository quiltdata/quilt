import { basename } from 'path'

import * as dateFns from 'date-fns'
import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import Message from 'components/Message'
import * as Preview from 'components/Preview'
import Sparkline from 'components/Sparkline'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import { getBreadCrumbs, up, decode, handleToHttpsUri } from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'

import Code from './Code'
import FileProperties from './FileProperties'
import * as FileView from './FileView'
import Section from './Section'
import renderPreview from './renderPreview'
import * as requests from './requests'
import { useViewModes, viewModeToSelectOption } from './viewModes'

const getCrumbs = ({ bucket, path, urls }) =>
  R.chain(
    ({ label, path: segPath }) => [
      Crumb.Segment({ label, to: urls.bucketDir(bucket, segPath) }),
      Crumb.Sep(<>&nbsp;/ </>),
    ],
    [{ label: bucket, path: '' }, ...getBreadCrumbs(up(path))],
  )

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

  const containerRef = React.useRef()
  const [anchor, setAnchor] = React.useState()
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  const classes = useVersionInfoStyles()

  const getHttpsUri = (v) => handleToHttpsUri({ bucket, key: path, version: v.id })
  const getCliArgs = (v) => `--bucket ${bucket} --key "${path}" --version-id ${v.id}`

  const copyHttpsUri = (v) => (e) => {
    e.preventDefault()
    copyToClipboard(getHttpsUri(v), { container: containerRef.current })
    push('HTTPS URI copied to clipboard')
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
                          title="Copy object version's canonical HTTPS URI to the clipboard"
                          href={getHttpsUri(v)}
                          onClick={copyHttpsUri(v)}
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
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: 'auto',
  },
  at: {
    color: t.palette.text.secondary,
  },
  button: {
    marginLeft: t.spacing(2),
  },
  crumbs: {
    ...t.typography.body1,
    maxWidth: '100%',
    overflowWrap: 'break-word',
  },
  fileProperties: {
    marginTop: '2px',
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
}))

export default function File({
  match: {
    params: { bucket, path: encodedPath },
  },
  location,
}) {
  const { version, mode } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const { analyticsBucket, noDownload } = Config.use()
  const s3 = AWS.S3.use()

  const path = decode(encodedPath)

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

  const viewModes = useViewModes(path, mode)

  const onViewModeChange = React.useCallback(
    (m) => {
      history.push(urls.bucketFile(bucket, encodedPath, version, m.valueOf()))
    },
    [history, urls, bucket, encodedPath, version],
  )

  const handle = { bucket, key: path, version }

  const previewOptions = React.useMemo(
    () => ({ context: Preview.CONTEXT.FILE, mode: viewModes.mode }),
    [viewModes.mode],
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

  return (
    <FileView.Root>
      <MetaTitle>{[path || 'Files', bucket]}</MetaTitle>

      <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
        {renderCrumbs(getCrumbs({ bucket, path, urls }))}
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
          <FileProperties className={classes.fileProperties} data={versionExistsData} />
          {!!viewModes.modes.length && (
            <FileView.ViewModeSelector
              className={classes.button}
              options={viewModes.modes.map(viewModeToSelectOption)}
              value={viewModeToSelectOption(viewModes.mode)}
              onChange={onViewModeChange}
            />
          )}
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
              <Code>{code}</Code>
              {!!analyticsBucket && <Analytics {...{ analyticsBucket, bucket, path }} />}
              <Meta bucket={bucket} path={path} version={version} />
              <Section icon="remove_red_eye" heading="Preview" defaultExpanded>
                {versionExistsData.case({
                  _: () => <CenteredProgress />,
                  Err: (e) => {
                    throw e
                  },
                  Ok: withPreview(renderPreview(viewModes.handlePreviewResult)),
                })}
              </Section>
            </>
          ),
          _: () => <Message headline="No Such Object" />,
        }),
      })}
    </FileView.Root>
  )
}
