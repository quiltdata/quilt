import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import Message from 'components/Message'
import * as Preview from 'components/Preview'
import cfg from 'constants/config'
import * as Bookmarks from 'containers/Bookmarks'
import * as Notifications from 'containers/Notifications'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import * as Format from 'utils/format'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'

import AssistButton from '../AssistButton'
import * as Download from '../Download'
import FileProperties from '../FileProperties'
import * as FileView from '../FileView'
import FallbackToDir from '../FallbackToDir'
import Section from '../Section'
import renderPreview from '../renderPreview'
import * as requests from '../requests'
import { useViewModes, viewModeToSelectOption } from '../viewModes'

import Analytics from './Analytics'
import * as AssistantContext from './AssistantContext'

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

  const getHttpsUri = (v) =>
    s3paths.handleToHttpsUri({ bucket, key: path, version: v.id })
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
      <AssistantContext.VersionsContext data={data} />
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
                  component={RRDom.Link}
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

function CenteredProgress() {
  return (
    <M.Box textAlign="center" width="100%">
      <M.CircularProgress />
    </M.Box>
  )
}

const useFileEditorSectionStyles = M.makeStyles(() => ({
  title: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
  },
  button: {
    margin: '0 0 0 auto',
    textTransform: 'none',
  },
}))

function FileEditorSection({ preview, onPreview, children }) {
  const classes = useFileEditorSectionStyles()
  return (
    <Section
      icon="text_fields"
      heading={
        <div className={classes.title}>
          Edit content
          {onPreview && (
            <FileEditor.PreviewButton
              className={classes.button}
              preview={preview}
              onPreview={onPreview}
            />
          )}
        </div>
      }
      expandable={false}
    >
      {children}
    </Section>
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
  editor: {
    minHeight: t.spacing(50),
  },
  topBar: {
    alignItems: 'flex-end',
    display: 'flex',
    marginBottom: t.spacing(2),
    flexWrap: 'wrap',
  },
  tooltip: {
    padding: t.spacing(0, 1),
  },
  preview: {
    width: '100%',
  },
}))

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true }

function File() {
  const location = RRDom.useLocation()
  const { bucket, path: encodedPath } = RRDom.useParams()

  const { version, mode } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()
  const s3 = AWS.S3.use()
  const { prefs } = BucketPreferences.use()

  const path = s3paths.decode(encodedPath)

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
  const crumbs = BreadCrumbs.use(s3paths.up(path), getSegmentRoute, bucket, {
    tailLink: true,
    tailSeparator: true,
  })

  return (
    <FileView.Root>
      <AssistantContext.CurrentVersionContext
        {...{ version, objExistsData, versionExistsData }}
      />

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

          <Buttons.WithPopover label="Modify" icon="settings">
            <M.List dense>
              <M.ListItem button>
                <M.ListItemIcon>
                  <M.Icon>turned_in_not</M.Icon>
                </M.ListItemIcon>
                <M.ListItemText
                  primary="Add to bookmarks"
                  primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
                />
              </M.ListItem>
            </M.List>

            <M.Divider />

            <M.List dense>
              <M.ListItem button>
                <M.ListItemIcon>
                  <M.Icon>edit</M.Icon>
                </M.ListItemIcon>
                <M.ListItemText
                  primary="Edit text content"
                  primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
                />
              </M.ListItem>
            </M.List>

            <M.Divider />

            <M.List dense>
              <M.ListSubheader inset>View as</M.ListSubheader>
              {viewModes.modes.map((mode) => (
                <M.ListItem button>
                  {mode === viewModes.mode && (
                    <M.ListItemIcon>
                      <M.Icon>check</M.Icon>
                    </M.ListItemIcon>
                  )}
                  <M.ListItemText
                    inset={mode !== viewModes.mode}
                    primary={mode}
                    primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
                  />
                </M.ListItem>
              ))}
            </M.List>

            <M.Divider />

            <M.List dense>
              <M.ListItem button>
                <M.ListItemIcon>
                  <M.Icon color="error">delete</M.Icon>
                </M.ListItemIcon>
                <M.ListItemText
                  primary="Delete"
                  primaryTypographyProps={{
                    ...LIST_ITEM_TYPOGRAPHY_PROPS,
                    color: 'error',
                  }}
                />
              </M.ListItem>
            </M.List>
          </Buttons.WithPopover>

          {/* !!viewModes.modes.length && (
            <FileView.ViewModeSelector
              className={classes.button}
              options={viewModes.modes.map(viewModeToSelectOption)}
              value={viewModeToSelectOption(viewModes.mode)}
              onChange={onViewModeChange}
            />
          ) */}
          {/*BucketPreferences.Result.match(
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
          )*/}
          {/* bookmarks && (
            <Buttons.Iconized
              className={classes.button}
              icon={isBookmarked ? 'turned_in' : 'turned_in_not'}
              label={isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
              onClick={() => bookmarks.toggle('main', handle)}
            />
          )*/}
          {downloadable &&
            BucketPreferences.Result.match(
              {
                Ok: ({ ui: { blocks } }) => (
                  <Download.Button className={classes.button} label="Get file">
                    <Download.BucketOptions handle={handle} hideCode={!blocks.code} />
                  </Download.Button>
                ),
                Pending: () => (
                  <Buttons.Skeleton className={classes.button} size="small" />
                ),
                Init: () => null,
              },
              prefs,
            )}
          {BucketPreferences.Result.match(
            {
              // XXX: only show this when the object exists?
              Ok: ({ ui }) => ui.blocks.qurator && <AssistButton edge="end" />,
              _: () => null,
            },
            prefs,
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
                      {!!cfg.analyticsBucket && !!blocks.analytics && (
                        <Analytics {...{ bucket, path }} />
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
                <FileEditorSection
                  onPreview={editorState.onPreview}
                  preview={editorState.preview}
                >
                  <FileEditor.Editor
                    {...editorState}
                    className={classes.editor}
                    handle={handle}
                  />
                </FileEditorSection>
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
              <FileEditorSection
                onPreview={editorState.onPreview}
                preview={editorState.preview}
              >
                <FileEditor.Editor
                  {...editorState}
                  className={classes.editor}
                  empty
                  handle={handle}
                />
              </FileEditorSection>
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

export default function FileWrapper() {
  const { bucket, path: key } = RRDom.useParams()
  const location = RRDom.useLocation()
  const { version } = parseSearch(location.search)
  const handle = React.useMemo(() => ({ bucket, key, version }), [bucket, key, version])
  return (
    <FallbackToDir handle={handle}>
      <File />
    </FallbackToDir>
  )
}
