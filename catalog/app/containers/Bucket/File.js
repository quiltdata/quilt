import { basename } from 'path'

import * as dateFns from 'date-fns'
import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedRelative } from 'react-intl'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import Message from 'components/Message'
import Sparkline from 'components/Sparkline'
import * as Notifications from 'containers/Notifications'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import StyledLink, { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import parseSearch from 'utils/parseSearch'
import { getBreadCrumbs, up, decode, handleToHttpsUri } from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'

import Code from './Code'
import FilePreview from './FilePreview'
import Section from './Section'
import * as requests from './requests'
import { withSignedUrl } from './utils'

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
  const s3req = AWS.S3.useRequest()
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

  const data = useData(requests.objectVersions, { s3req, bucket, path })

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
                        <FormattedRelative value={v.lastModified} />
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
                        withSignedUrl({ bucket, key: path, version: v.id }, (url) => (
                          <M.IconButton
                            href={url}
                            title="Download this version of the object"
                          >
                            <M.Icon>arrow_downward</M.Icon>
                          </M.IconButton>
                        ))}
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

const AnnotationsBox = M.styled('div')(({ theme: t }) => ({
  background: M.colors.lightBlue[50],
  border: [[1, 'solid', M.colors.lightBlue[400]]],
  borderRadius: t.shape.borderRadius,
  fontFamily: t.typography.monospace.fontFamily,
  fontSize: t.typography.body2.fontSize,
  overflow: 'auto',
  padding: t.spacing(1),
  whiteSpace: 'pre',
  width: '100%',
}))

function Annotations({ bucket, path, version }) {
  const s3req = AWS.S3.useRequest()
  const data = useData(requests.objectMeta, { s3req, bucket, path, version })
  return data.case({
    Ok: (meta) =>
      !!meta &&
      !R.isEmpty(meta) && (
        <Section icon="list" heading="Annotations">
          <AnnotationsBox>{JSON.stringify(meta, null, 2)}</AnnotationsBox>
        </Section>
      ),
    _: () => null,
  })
}

function Analytics({ analyticsBucket, bucket, path }) {
  const [cursor, setCursor] = React.useState(null)
  const s3req = AWS.S3.useRequest()
  const today = React.useMemo(() => new Date(), [])
  const formatDate = (date) =>
    dateFns.format(
      date,
      today.getFullYear() === date.getFullYear() ? 'd MMM' : 'd MMM yyyy',
    )
  const data = useData(requests.objectAccessCounts, {
    s3req,
    analyticsBucket,
    bucket,
    path,
    today,
  })

  return (
    <Section
      icon="bar_charts"
      heading="Analytics"
      defaultExpanded={AsyncResult.Ok.is(data.result)}
    >
      {data.case({
        Ok: ({ counts, total }) => (
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
  spacer: {
    flexGrow: 1,
  },
  button: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
}))

export default function File({
  match: {
    params: { bucket, path: encodedPath },
  },
  location,
}) {
  const { version } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { analyticsBucket, noDownload } = Config.use()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const s3req = AWS.S3.useRequest()

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

  const objExistsData = useData(requests.getObjectExistence, { s3req, bucket, key: path })
  const versionExistsData = useData(requests.getObjectExistence, {
    s3req,
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
        Exists: ({ deleted }) => !deleted,
      }),
    })

  return (
    <M.Box pt={2} pb={4}>
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
        <div className={classes.spacer} />
        {downloadable &&
          withSignedUrl({ bucket, key: path, version }, (url) =>
            xs ? (
              <M.IconButton
                className={classes.button}
                href={url}
                edge="end"
                size="small"
                download
              >
                <M.Icon>arrow_downward</M.Icon>
              </M.IconButton>
            ) : (
              <M.Button
                href={url}
                className={classes.button}
                variant="outlined"
                size="small"
                startIcon={<M.Icon>arrow_downward</M.Icon>}
                download
              >
                Download file
              </M.Button>
            ),
          )}
      </div>
      {objExistsData.case({
        _: () => <CenteredProgress />,
        Err: (e) => {
          throw e
        },
        Ok: requests.ObjectExistence.case({
          Exists: () => (
            <>
              <Code>{code}</Code>
              {!!analyticsBucket && <Analytics {...{ analyticsBucket, bucket, path }} />}
              <Section icon="remove_red_eye" heading="Contents" defaultExpanded>
                {versionExistsData.case({
                  _: () => <CenteredProgress />,
                  Err: (e) => {
                    throw e
                  },
                  Ok: requests.ObjectExistence.case({
                    Exists: (h) =>
                      !h.deleted ? (
                        <FilePreview handle={{ bucket, key: path, version }} />
                      ) : (
                        <M.Box textAlign="center" width="100%">
                          <M.Typography variant="h6" gutterBottom>
                            DELETE MARKER
                          </M.Typography>
                          <M.Typography variant="body1">
                            Selected version of the object is a{' '}
                            <StyledLink
                              href="https://docs.aws.amazon.com/AmazonS3/latest/dev/DeleteMarker.html"
                              target="_blank"
                            >
                              delete marker
                            </StyledLink>
                          </M.Typography>
                        </M.Box>
                      ),
                    DoesNotExist: () => (
                      <M.Box textAlign="center" width="100%">
                        <M.Typography variant="h6" gutterBottom>
                          INVALID VERSION
                        </M.Typography>
                        <M.Typography variant="body1">
                          Invalid version id specified
                        </M.Typography>
                      </M.Box>
                    ),
                  }),
                })}
              </Section>
              <Annotations bucket={bucket} path={path} version={version} />
            </>
          ),
          _: () => <Message headline="No Such Object" />,
        }),
      })}
    </M.Box>
  )
}
