import { basename } from 'path'

import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import Message from 'components/Message'
import * as Preview from 'components/Preview'
import Sparkline from 'components/Sparkline'
import cfg from 'constants/config'
import * as Bookmarks from 'containers/Bookmarks'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import { up, decode, handleToHttpsUri } from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'

import FileCodeSamples from './CodeSamples/File'
import FileProperties from './FileProperties'
import * as FileView from './FileView'
import QuratorSection from './Qurator/Section'
import Section from './Section'
import renderPreview from './renderPreview'
import * as requests from './requests'
import { useViewModes, viewModeToSelectOption } from './viewModes'

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

function Analytics({ bucket, path }) {
  const [cursor, setCursor] = React.useState(null)
  const s3 = AWS.S3.use()
  const today = React.useMemo(() => new Date(), [])
  const formatDate = (date) =>
    dateFns.format(
      date,
      today.getFullYear() === date.getFullYear() ? 'd MMM' : 'd MMM yyyy',
    )
  const data = useData(requests.objectAccessCounts, { s3, bucket, path, today })

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
    flexShrink: 0,
    marginBottom: -3,
    marginLeft: 'auto',
    marginTop: -3,
  },
  at: {
    color: t.palette.text.secondary,
  },
  button: {
    marginLeft: t.spacing(1),
  },
  crumbs: {
    ...t.typography.body1,
    maxWidth: '100%',
    overflowWrap: 'break-word',
  },
  fileProperties: {
    marginRight: t.spacing(1),
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
    flexWrap: 'wrap',
  },
  editTitle: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
  },
  editButton: {
    margin: t.spacing(-1, 1, -1, 'auto'),
  },
  preview: {
    width: '100%',
  },
}))

export default function File() {
  const location = useLocation()
  const { bucket, path: encodedPath } = useParams()

  const { version, mode } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const s3 = AWS.S3.use()
  const prefs = BucketPreferences.use()

  const path = decode(encodedPath)

  const [resetKey, setResetKey] = React.useState(0)
  const objExistsData = useData(requests.getObjectExistence, {
    s3,
    bucket,
    key: path,
    resetKey,
  })
  const versionExistsData = useData(requests.getObjectExistence, {
    s3,
    bucket,
    key: path,
    version,
    resetKey,
  })

  const objExists = objExistsData.case({
    _: () => false,
    Ok: requests.ObjectExistence.case({
      Exists: () => true,
      _: () => false,
    }),
  })

  const { downloadable, fileVersionId } = versionExistsData.case({
    _: () => ({
      downloadable: false,
    }),
    Ok: requests.ObjectExistence.case({
      _: () => ({
        downloadable: false,
      }),
      Exists: ({ deleted, archived, version: versionId }) => ({
        downloadable:
          !cfg.noDownload &&
          !deleted &&
          !archived &&
          BucketPreferences.Result.match(
            {
              Ok: ({ ui }) => ui.actions.downloadObject,
              _: R.F,
            },
            prefs,
          ),
        fileVersionId: versionId,
      }),
    }),
  })

  const viewModes = useViewModes(mode)

  const onViewModeChange = React.useCallback(
    (m) => {
      history.push(urls.bucketFile(bucket, encodedPath, { version, mode: m.valueOf() }))
    },
    [history, urls, bucket, encodedPath, version],
  )

  const handle = React.useMemo(
    () => ({ bucket, key: path, version: fileVersionId }),
    [bucket, path, fileVersionId],
  )

  const editorState = FileEditor.useState(handle)
  const onSave = editorState.onSave
  const handleEditorSave = React.useCallback(async () => {
    await onSave()
    setResetKey(R.inc)
  }, [onSave])

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
  const bookmarks = Bookmarks.use()
  const isBookmarked = React.useMemo(
    () => bookmarks?.isBookmarked('main', handle),
    [bookmarks, handle],
  )

  const getSegmentRoute = React.useCallback(
    (segPath) => urls.bucketDir(bucket, segPath),
    [bucket, urls],
  )
  const crumbs = BreadCrumbs.use(up(path), getSegmentRoute, bucket, {
    tailLink: true,
    tailSeparator: true,
  })

  return (
    <FileView.Root>
      <MetaTitle>{[path || 'Files', bucket]}</MetaTitle>

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
          <FileProperties className={classes.fileProperties} data={versionExistsData} />
          {!!viewModes.modes.length && (
            <FileView.ViewModeSelector
              className={classes.button}
              options={viewModes.modes.map(viewModeToSelectOption)}
              value={viewModeToSelectOption(viewModes.mode)}
              onChange={onViewModeChange}
            />
          )}
          {BucketPreferences.Result.match(
            {
              Ok: ({ ui: { actions } }) =>
                actions.writeFile &&
                FileEditor.isSupportedFileType(handle.key) && (
                  <FileEditor.Controls
                    {...editorState}
                    className={classes.button}
                    onSave={handleEditorSave}
                  />
                ),
              _: () => null,
            },
            prefs,
          )}
          {bookmarks && (
            <Buttons.Iconized
              className={classes.button}
              icon={isBookmarked ? 'turned_in' : 'turned_in_not'}
              label={isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
              onClick={() => bookmarks.toggle('main', handle)}
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
              {BucketPreferences.Result.match(
                {
                  Ok: ({ ui: { blocks } }) => (
                    <>
                      {blocks.code && <FileCodeSamples {...{ bucket, path }} />}
                      {!!cfg.analyticsBucket && !!blocks.analytics && (
                        <Analytics {...{ bucket, path }} />
                      )}
                      {cfg.qurator && blocks.qurator && (
                        <QuratorSection handle={handle} />
                      )}
                      {blocks.meta && (
                        <>
                          <FileView.ObjectMeta handle={handle} />
                          <FileView.ObjectTags handle={handle} />
                        </>
                      )}
                    </>
                  ),
                  _: () => null,
                },
                prefs,
              )}
              {editorState.editing ? (
                <Section
                  icon="text_fields"
                  heading={({ expanded }) => (
                    <div className={classes.editTitle}>
                      Edit content
                      {expanded && editorState.onPreview && (
                        <FileEditor.PreviewButton
                          className={classes.editButton}
                          {...editorState}
                        />
                      )}
                    </div>
                  )}
                  defaultExpanded
                >
                  <FileEditor.Editor {...editorState} handle={handle} />
                </Section>
              ) : (
                <Section icon="remove_red_eye" heading="Preview" defaultExpanded>
                  <div className={classes.preview}>
                    {versionExistsData.case({
                      _: () => <CenteredProgress />,
                      Err: (e) => {
                        throw e
                      },
                      Ok: withPreview(renderPreview(viewModes.handlePreviewResult)),
                    })}
                  </div>
                </Section>
              )}
            </>
          ),
          _: () =>
            editorState.editing ? (
              <Section icon="text_fields" heading="Edit content" defaultExpanded>
                <FileEditor.Editor {...editorState} empty handle={handle} />
              </Section>
            ) : (
              <>
                <Message headline="No Such Object">
                  {BucketPreferences.Result.match(
                    {
                      Ok: ({ ui: { actions } }) =>
                        actions.writeFile && (
                          <FileEditor.AddFileButton onClick={editorState.onEdit} />
                        ),
                      _: () => null,
                    },
                    prefs,
                  )}
                </Message>
              </>
            ),
        }),
      })}
    </FileView.Root>
  )
}
