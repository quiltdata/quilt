import cx from 'classnames'
import { FORM_ERROR } from 'final-form'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as RF from 'react-final-form'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { darken } from '@material-ui/core'

import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'
import * as validators from 'utils/validators'

import * as PD from './PackageDialog'
import * as requests from './requests'

const FilesEntry = tagged([
  'Dir', // { name: str, type: enum, children: [FilesEntry] }
  'File', // { name: str, type: enum, size: num }
])

const FilesAction = tagged([
  'Add', // { files: [File], prefix: str }
  'Delete', // path: str
  'DeleteDir', // prefix: str
  'Revert', // path: str
  'RevertDir', // prefix: str
  'Reset',
])

const insertIntoTree = (path = [], file, entries) => {
  let inserted = file
  let restEntries = entries
  if (path.length) {
    const [current, ...rest] = path
    let baseDir = FilesEntry.Dir({ name: current, type: file.type, children: [] })
    const existingDir = entries.find(
      FilesEntry.case({
        File: () => false,
        Dir: R.propEq('name', current),
      }),
    )
    if (existingDir) {
      restEntries = R.without([existingDir], entries)
      baseDir = existingDir
    }
    inserted = insertIntoDir(rest, file, baseDir)
  }
  const getOrder = FilesEntry.case({
    Dir: (d) => [0, d.name],
    File: (f) => [1, f.name],
  })
  const tree = R.sortBy(getOrder, [inserted, ...restEntries])
  return tree
}

const insertIntoDir = (path, file, dir) => {
  const { name, children } = FilesEntry.Dir.unbox(dir)
  const newChildren = insertIntoTree(path, file, children)
  const type = newChildren
    .map(FilesEntry.case({ Dir: R.prop('type'), File: R.prop('type') }))
    .reduce((acc, entryType) => (acc === entryType ? acc : 'modified'))
  return FilesEntry.Dir({ name, type, children: newChildren })
}

const dissocBy = (fn) =>
  R.pipe(
    R.toPairs,
    R.filter(([k]) => !fn(k)),
    R.fromPairs,
  )

/*
// TODO: use tree as the main data model / source of truth?
state type: {
  existing: { [path]: file },
  added: { [path]: file },
  // TODO: use Array or Set?
  deleted: { [path]: true },
}
*/

const handleFilesAction = FilesAction.case({
  Add: ({ files, prefix }) => (state) =>
    files.reduce((acc, file) => {
      const path = (prefix || '') + PD.getNormalizedPath(file)
      return R.evolve(
        {
          added: R.assoc(path, file),
          deleted: R.dissoc(path),
        },
        acc,
      )
    }, state),
  Delete: (path) => R.evolve({ deleted: R.assoc(path, true) }),
  // add all descendants from existing to deleted
  DeleteDir: (prefix) => ({ existing, added, deleted }) => ({
    existing,
    added,
    deleted: R.mergeLeft(
      Object.keys(existing).reduce(
        (acc, k) => (k.startsWith(prefix) ? { ...acc, [k]: true } : acc),
        {},
      ),
      deleted,
    ),
  }),
  Revert: (path) => R.evolve({ added: R.dissoc(path), deleted: R.dissoc(path) }),
  // remove all descendants from added and deleted
  RevertDir: (prefix) =>
    R.evolve({
      added: dissocBy(R.startsWith(prefix)),
      deleted: dissocBy(R.startsWith(prefix)),
    }),
  Reset: (_, { initial }) => () => initial,
})

const computeEntries = ({ added, deleted, existing }) => {
  const existingEntries = Object.entries(existing).map(([path, { size }]) => {
    if (path in deleted) {
      return { type: 'deleted', path, size }
    }
    if (path in added) {
      const a = added[path]
      return { type: 'modified', path, size: a.size }
    }
    return { type: 'unchanged', path, size }
  })
  const addedEntries = Object.entries(added).reduce((acc, [path, { size }]) => {
    if (path in existing) return acc
    return acc.concat({ type: 'added', path, size })
  }, [])
  const entries = [...existingEntries, ...addedEntries]
  return entries.reduce((children, { path, ...rest }) => {
    const parts = path.split('/')
    const prefixPath = R.init(parts).map((p) => `${p}/`)
    const name = R.last(parts)
    const file = FilesEntry.File({ name, ...rest })
    return insertIntoTree(prefixPath, file, children)
  }, [])
}

const COLORS = {
  default: M.colors.grey[900],
  added: M.colors.green[900],
  modified: darken(M.colors.yellow[900], 0.2),
  deleted: M.colors.red[900],
}

const useEntryIconStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  icon: {
    boxSizing: 'content-box',
    display: 'block',
    fontSize: 18,
    padding: 3,
  },
  stateContainer: {
    alignItems: 'center',
    background: 'currentColor',
    border: `1px solid ${t.palette.background.paper}`,
    borderRadius: '100%',
    bottom: 0,
    display: 'flex',
    height: 12,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: 12,
  },
  state: {
    fontFamily: t.typography.fontFamily,
    fontWeight: t.typography.fontWeightBold,
    fontSize: 9,
    color: t.palette.background.paper,
  },
}))

function EntryIcon({ state, children }) {
  const classes = useEntryIconStyles()
  const stateContents =
    state &&
    {
      added: '+',
      deleted: <>&ndash;</>,
      modified: '~',
    }[state]
  return (
    <div className={classes.root}>
      <M.Icon className={classes.icon}>{children}</M.Icon>
      {!!stateContents && (
        <div className={classes.stateContainer}>
          <div className={classes.state}>{stateContents}</div>
        </div>
      )}
    </div>
  )
}

const useFileStyles = M.makeStyles((t) => ({
  added: {},
  modified: {},
  deleted: {},
  unchanged: {},
  root: {
    background: t.palette.background.paper,
    color: COLORS.default,
    cursor: 'default',
    outline: 'none',
    '&$added': {
      color: COLORS.added,
    },
    '&$modified': {
      color: COLORS.modified,
    },
    '&$deleted': {
      color: COLORS.deleted,
    },
  },
  contents: {
    alignItems: 'center',
    display: 'flex',
    opacity: 0.7,
    '$root:hover > &': {
      opacity: 1,
    },
  },
  name: {
    ...t.typography.body2,
    flexGrow: 1,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  size: {
    ...t.typography.body2,
    marginRight: t.spacing(0.5),
    opacity: 0.6,
  },
}))

function File({ name, type, size, prefix, dispatch }) {
  const classes = useFileStyles()

  const path = (prefix || '') + name

  const handle = React.useCallback(
    (cons) => (e) => {
      e.stopPropagation()
      dispatch(cons(path))
    },
    [dispatch, path],
  )

  const action = React.useMemo(
    () =>
      ({
        added: { hint: 'Remove', icon: 'clear', handler: handle(FilesAction.Revert) },
        modified: {
          hint: 'Revert',
          icon: 'undo',
          handler: handle(FilesAction.Revert),
        },
        deleted: {
          hint: 'Restore',
          icon: 'undo',
          handler: handle(FilesAction.Revert),
        },
        unchanged: { hint: 'Delete', icon: 'clear', handler: handle(FilesAction.Delete) },
      }[type]),
    [type, handle],
  )

  const onClick = React.useCallback((e) => {
    e.stopPropagation()
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={cx(classes.root, classes[type])}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={classes.contents}>
        <EntryIcon state={type}>insert_drive_file</EntryIcon>
        <div className={classes.name} title={name}>
          {name}
        </div>
        <div className={classes.size}>{readableBytes(size)}</div>
        <M.IconButton onClick={action.handler} title={action.hint} size="small">
          <M.Icon fontSize="inherit">{action.icon}</M.Icon>
        </M.IconButton>
      </div>
    </div>
  )
}

const useDirStyles = M.makeStyles((t) => ({
  // TODO: support non-diff mode (for package creation)
  diff: {},
  added: {},
  modified: {},
  deleted: {},
  unchanged: {},
  active: {},
  root: {
    background: t.palette.background.paper,
    cursor: 'pointer',
    outline: 'none',
    position: 'relative',
  },
  head: {
    alignItems: 'center',
    color: COLORS.default,
    display: 'flex',
    opacity: 0.7,
    outline: 'none',
    '$active > &, &:hover': {
      opacity: 1,
    },
    '$added > &': {
      color: COLORS.added,
    },
    '$modified > &': {
      color: COLORS.modified,
    },
    '$deleted > &': {
      color: COLORS.deleted,
    },
  },
  name: {
    ...t.typography.body2,
    flexGrow: 1,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    paddingLeft: 20,
  },
  bar: {
    bottom: 0,
    left: 0,
    opacity: 0.3,
    position: 'absolute',
    top: 24,
    width: 24,
    '$active > $head > &, $head:hover > &': {
      opacity: 0.4,
    },
    '&::before': {
      background: 'currentColor',
      borderRadius: 2,
      bottom: 4,
      content: '""',
      left: 10,
      position: 'absolute',
      top: 4,
      width: 4,
    },
  },
  emptyDummy: {
    height: 24,
  },
  empty: {
    ...t.typography.body2,
    bottom: 0,
    fontStyle: 'italic',
    left: 24,
    lineHeight: '24px',
    opacity: 0.6,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 24,
  },
}))

function Dir({ name, type, children, prefix, dispatch }) {
  const classes = useDirStyles()
  // TODO: move state out?
  const [expanded, setExpanded] = React.useState(true)

  const toggleExpanded = React.useCallback(
    (e) => {
      e.stopPropagation()
      setExpanded((x) => !x)
    },
    [setExpanded],
  )

  const onClick = React.useCallback((e) => {
    e.stopPropagation()
  }, [])

  const path = (prefix || '') + name

  const onDrop = React.useCallback(
    (files) => {
      dispatch(FilesAction.Add({ prefix: path, files }))
    },
    [dispatch, path],
  )

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    noDragEventsBubbling: true,
  })

  const handle = React.useCallback(
    (cons) => (e) => {
      e.stopPropagation()
      dispatch(cons(path))
    },
    [dispatch, path],
  )

  const action = React.useMemo(
    () =>
      ({
        added: { hint: 'Remove', icon: 'clear', handler: handle(FilesAction.RevertDir) },
        modified: {
          hint: 'Revert',
          icon: 'undo',
          handler: handle(FilesAction.RevertDir),
        },
        deleted: {
          hint: 'Restore',
          icon: 'undo',
          handler: handle(FilesAction.RevertDir),
        },
        unchanged: {
          hint: 'Delete',
          icon: 'clear',
          handler: handle(FilesAction.DeleteDir),
        },
      }[type]),
    [type, handle],
  )

  return (
    <div
      {...getRootProps({
        className: cx(classes.root, classes[type], { [classes.active]: isDragActive }),
        onClick,
      })}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div onClick={toggleExpanded} className={classes.head} role="button" tabIndex={0}>
        <EntryIcon state={type}>{expanded ? 'folder_open' : 'folder'}</EntryIcon>
        <div className={classes.name}>{name}</div>
        <M.IconButton onClick={action.handler} title={action.hint} size="small">
          <M.Icon fontSize="inherit">{action.icon}</M.Icon>
        </M.IconButton>
        <div className={classes.bar} />
        {!children.length && <div className={classes.empty}>{'<EMPTY DIRECTORY>'}</div>}
      </div>
      <M.Collapse in={expanded}>
        <div className={classes.body}>
          {children.length ? (
            children.map((entry) => {
              const [Component, props] = FilesEntry.case(
                {
                  Dir: (ps) => [Dir, ps],
                  File: (ps) => [File, ps],
                },
                entry,
              )
              return (
                <Component {...{ ...props, key: props.name, prefix: path, dispatch }} />
              )
            })
          ) : (
            <div className={classes.emptyDummy} />
          )}
        </div>
      </M.Collapse>
    </div>
  )
}

const useFilesInputStyles = M.makeStyles((t) => ({
  root: {
    marginTop: 22,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    height: 24,
  },
  headerFiles: {
    ...t.typography.body1,
    display: 'flex',
  },
  headerFilesDisabled: {
    color: t.palette.text.secondary,
  },
  headerFilesError: {
    color: t.palette.error.main,
  },
  headerFilesWarn: {
    color: t.palette.warning.dark,
  },
  headerFilesAdded: {
    color: t.palette.success.main,
    marginLeft: t.spacing(0.5),
  },
  headerFilesDeleted: {
    color: t.palette.error.main,
    marginLeft: t.spacing(0.5),
  },
  dropzoneContainer: {
    marginTop: t.spacing(2),
    position: 'relative',
  },
  dropzone: {
    background: t.palette.action.hover,
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    minHeight: t.spacing(23),
    outline: 'none',
    overflow: 'hidden',
  },
  dropzoneErr: {
    borderColor: t.palette.error.main,
  },
  dropzoneWarn: {
    borderColor: t.palette.warning.dark,
  },
  active: {
    background: t.palette.action.selected,
  },
  dropMsg: {
    ...t.typography.body2,
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: t.spacing(1),
    paddingTop: t.spacing(1),
    textAlign: 'center',
  },
  dropMsgErr: {
    color: t.palette.error.main,
  },
  dropMsgWarn: {
    color: t.palette.warning.dark,
  },
  filesContainer: {
    direction: 'rtl', // show the scrollbar on the right
    borderBottom: `1px solid ${t.palette.action.disabled}`,
    maxHeight: t.spacing(64),
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  filesContainerErr: {
    borderColor: t.palette.error.main,
  },
  filesContainerWarn: {
    borderColor: t.palette.warning.dark,
  },
  filesContainerInner: {
    direction: 'ltr',
  },
  lock: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    bottom: 0,
    cursor: 'not-allowed',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressContainer: {
    display: 'flex',
    position: 'relative',
  },
  progressPercent: {
    ...t.typography.h5,
    alignItems: 'center',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  progressSize: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
}))

function FilesInput({
  input: { value, onChange },
  meta,
  uploads,
  onFilesAction,
  errors = {},
}) {
  const classes = useFilesInputStyles()

  const disabled = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const totalSize = React.useMemo(
    () => Object.values(value.added).reduce((sum, f) => sum + f.size, 0),
    [value.added],
  )

  const warn = totalSize > PD.MAX_SIZE

  // eslint-disable-next-line no-nested-ternary
  const label = error ? (
    errors[error] || error
  ) : warn ? (
    <>
      Total size of new files exceeds recommended maximum of {readableBytes(PD.MAX_SIZE)}
    </>
  ) : (
    'Drop files here or click to browse'
  )

  const ref = React.useRef()
  ref.current = {
    value,
    disabled,
    initial: meta.initial,
    onChange,
    onFilesAction,
  }
  const { current: dispatch } = React.useRef((action) => {
    const cur = ref.current
    if (cur.disabled) return
    const newValue = handleFilesAction(action, { initial: cur.initial })(cur.value)
    cur.onChange(newValue)
    if (cur.onFilesAction) cur.onFilesAction(action, cur.value, newValue)
  })

  const onDrop = React.useCallback(
    (files) => {
      dispatch(FilesAction.Add({ files }))
    },
    [dispatch],
  )

  const resetFiles = React.useCallback(() => {
    dispatch(FilesAction.Reset())
  }, [dispatch])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const totalProgress = React.useMemo(() => getTotalProgress(uploads), [uploads])

  const computedEntries = useMemoEq(value, computeEntries)

  const stats = useMemoEq(value, ({ added, deleted, existing }) => ({
    added: Object.values(added).reduce(
      (acc, f) => R.evolve({ count: R.inc, size: R.add(f.size) }, acc),
      { count: 0, size: 0 },
    ),
    deleted: Object.keys(deleted).reduce(
      (acc, path) => R.evolve({ count: R.inc, size: R.add(existing[path].size) }, acc),
      { count: 0, size: 0 },
    ),
  }))

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div
          className={cx(
            classes.headerFiles,
            disabled // eslint-disable-line no-nested-ternary
              ? classes.headerFilesDisabled
              : error // eslint-disable-line no-nested-ternary
              ? classes.headerFilesError
              : warn
              ? classes.headerFilesWarn
              : undefined,
          )}
        >
          Files
          {(!!stats.added.count || !!stats.deleted.count) && (
            <>
              :
              {!!stats.added.count && (
                <span className={classes.headerFilesAdded}>
                  {' +'}
                  {stats.added.count} ({readableBytes(stats.added.size)})
                </span>
              )}
              {!!stats.deleted.count && (
                <span className={classes.headerFilesDeleted}>
                  {' -'}
                  {stats.deleted.count} ({readableBytes(stats.deleted.size)})
                </span>
              )}
              {warn && <M.Icon style={{ marginLeft: 4 }}>error_outline</M.Icon>}
            </>
          )}
        </div>
        <M.Box flexGrow={1} />
        {meta.dirty && (
          <M.Button
            onClick={resetFiles}
            disabled={disabled}
            size="small"
            endIcon={<M.Icon fontSize="small">undo</M.Icon>}
          >
            Undo changes
          </M.Button>
        )}
      </div>

      <div className={classes.dropzoneContainer}>
        <div
          {...getRootProps({
            className: cx(
              classes.dropzone,
              isDragActive && !disabled && classes.active,
              !!error && classes.dropzoneErr,
              !error && warn && classes.dropzoneWarn,
            ),
          })}
        >
          <input {...getInputProps()} />

          {!!computedEntries.length && (
            <div
              className={cx(
                classes.filesContainer,
                !!error && classes.filesContainerErr,
                !error && warn && classes.filesContainerWarn,
              )}
            >
              <div className={classes.filesContainerInner}>
                {computedEntries.map((entry) => {
                  const [Component, props, key] = FilesEntry.case(
                    {
                      Dir: (ps) => [Dir, ps, `dir:${ps.name}`],
                      File: (ps) => [File, ps, `file:${ps.name}`],
                    },
                    entry,
                  )
                  return <Component {...{ ...props, key, dispatch }} />
                })}
              </div>
            </div>
          )}

          <div
            className={cx(
              classes.dropMsg,
              !!error && classes.dropMsgErr,
              !error && warn && classes.dropMsgWarn,
            )}
          >
            <span>{label}</span>
          </div>
        </div>
        {disabled && (
          <div className={classes.lock}>
            {!!totalProgress.total && (
              <>
                <div className={classes.progressContainer}>
                  <M.CircularProgress
                    size={80}
                    value={totalProgress.percent}
                    variant="determinate"
                  />
                  <div className={classes.progressPercent}>{totalProgress.percent}%</div>
                </div>
                <div className={classes.progressSize}>
                  {readableBytes(totalProgress.loaded)}
                  {' / '}
                  {readableBytes(totalProgress.total)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  files: {
    marginTop: t.spacing(2),
  },
  meta: {
    marginTop: t.spacing(3),
  },
}))

const getTotalProgress = R.pipe(
  R.values,
  R.reduce(
    (acc, { progress: p = {} }) => ({
      total: acc.total + (p.total || 0),
      loaded: acc.loaded + (p.loaded || 0),
    }),
    { total: 0, loaded: 0 },
  ),
  (p) => ({
    ...p,
    percent: p.total ? Math.floor((p.loaded / p.total) * 100) : 100,
  }),
)

const defaultNameWarning = ' ' // Reserve space for warning

function DialogForm({
  bucket,
  name: initialName,
  close,
  onSuccess,
  setSubmitting,
  manifest,
  workflowsConfig,
}) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const [uploads, setUploads] = React.useState({})
  const nameValidator = PD.useNameValidator()
  const nameExistence = PD.useNameExistence(bucket)
  const [nameWarning, setNameWarning] = React.useState('')
  const classes = useStyles()

  const initialMeta = React.useMemo(
    () => ({
      mode: 'kv',
      text: JSON.stringify(manifest.meta || {}),
    }),
    [manifest.meta],
  )

  const initialFiles = React.useMemo(
    () => ({ existing: manifest.entries, added: {}, deleted: {} }),
    [manifest.entries],
  )

  const initialWorkflow = React.useMemo(() => {
    const slug = manifest.workflow && manifest.workflow.id
    // reuse workflow from previous revision if it's still present in the config
    if (slug) {
      const w = workflowsConfig.workflows.find(R.propEq('slug', slug))
      if (w) return w
    }
    return PD.defaultWorkflowFromConfig(workflowsConfig)
  }, [manifest, workflowsConfig])

  const totalProgress = React.useMemo(() => getTotalProgress(uploads), [uploads])

  const onFilesAction = React.useMemo(
    () =>
      FilesAction.case({
        _: () => {},
        Revert: (path) => setUploads(R.dissoc(path)),
        RevertDir: (prefix) => setUploads(dissocBy(R.startsWith(prefix))),
        Reset: () => setUploads({}),
      }),
    [setUploads],
  )

  // eslint-disable-next-line consistent-return
  const onSubmit = async ({ name, msg, files, meta, workflow }) => {
    const toUpload = Object.entries(files.added).map(([path, file]) => ({ path, file }))

    const limit = pLimit(2)
    let rejected = false
    const uploadStates = toUpload.map(({ path, file }) => {
      // reuse state if file hasnt changed
      const entry = uploads[path]
      if (entry && entry.file === file) return { ...entry, path }

      const upload = s3.upload(
        {
          Bucket: bucket,
          Key: `${name}/${path}`,
          Body: file,
        },
        {
          queueSize: 2,
        },
      )
      upload.on('httpUploadProgress', ({ loaded }) => {
        if (rejected) return
        setUploads(R.assocPath([path, 'progress', 'loaded'], loaded))
      })
      const promise = limit(async () => {
        if (rejected) {
          setUploads(R.dissoc(path))
          return
        }
        const resultP = upload.promise()
        const hashP = PD.hashFile(file)
        try {
          // eslint-disable-next-line consistent-return
          return { result: await resultP, hash: await hashP }
        } catch (e) {
          rejected = true
          setUploads(R.dissoc(path))
          throw e
        }
      })
      return { path, file, upload, promise, progress: { total: file.size, loaded: 0 } }
    })

    pipeThru(uploadStates)(
      R.map(({ path, ...rest }) => ({ [path]: rest })),
      R.mergeAll,
      setUploads,
    )

    let uploaded
    try {
      uploaded = await Promise.all(uploadStates.map((x) => x.promise))
    } catch (e) {
      return { [FORM_ERROR]: PD.ERROR_MESSAGES.UPLOAD }
    }

    const newEntries = pipeThru(toUpload, uploaded)(
      R.zipWith((f, u) => [
        f.path,
        {
          physicalKey: s3paths.handleToS3Url({
            bucket,
            key: u.result.Key,
            version: u.result.VersionId,
          }),
          size: f.file.size,
          hash: u.hash,
          meta: R.prop('meta', files.existing[f.path]),
        },
      ]),
      R.fromPairs,
    )

    const contents = pipeThru(files.existing)(
      R.omit(Object.keys(files.deleted)),
      R.mergeLeft(newEntries),
      R.toPairs,
      R.map(([path, data]) => ({
        logical_key: path,
        physical_key: data.physicalKey,
        size: data.size,
        hash: data.hash,
        meta: data.meta,
      })),
      R.sortBy(R.prop('logical_key')),
    )

    try {
      const res = await req({
        endpoint: '/packages',
        method: 'POST',
        body: {
          name,
          registry: `s3://${bucket}`,
          message: msg,
          contents,
          meta: PD.getMetaValue(meta),
          workflow: PD.getWorkflowApiParam(workflow.slug),
        },
      })
      onSuccess({ name, hash: res.top_hash })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('error creating manifest', e)
      // TODO: handle specific cases?
      return { [FORM_ERROR]: e.message || PD.ERROR_MESSAGES.MANIFEST }
    }
  }

  const onSubmitWrapped = async (...args) => {
    setSubmitting(true)
    try {
      return await onSubmit(...args)
    } finally {
      setSubmitting(false)
    }
  }

  const onFormChange = React.useCallback(
    async ({ modified, values }) => {
      if (!modified.name) return

      const { name } = values

      setNameWarning(defaultNameWarning)

      if (initialName === name) return

      const nameExists = await nameExistence.validate(name)
      if (nameExists) {
        setNameWarning('Package with this name exists already')
      } else {
        setNameWarning('New package will be created')
      }
    },
    [initialName, nameExistence],
  )

  return (
    <RF.Form onSubmit={onSubmitWrapped}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
        form,
        values,
      }) => (
        <>
          <M.DialogTitle>Push package revision</M.DialogTitle>
          <M.DialogContent style={{ paddingTop: 0 }}>
            <form onSubmit={handleSubmit}>
              <RF.FormSpy
                subscription={{ modified: true, values: true }}
                onChange={onFormChange}
              />
              <M.Grid container spacing={2}>
                <M.Grid item xs={12} sm={6}>
                  <RF.Field
                    component={PD.PackageNameInput}
                    name="name"
                    validate={validators.composeAsync(
                      validators.required,
                      nameValidator.validate,
                    )}
                    validateFields={['name']}
                    errors={{
                      required: 'Enter a package name',
                      invalid: 'Invalid package name',
                    }}
                    helperText={nameWarning}
                    initialValue={initialName}
                  />

                  <RF.Field
                    component={PD.CommitMessageInput}
                    name="msg"
                    validate={validators.required}
                    validateFields={['msg']}
                    errors={{
                      required: 'Enter a commit message',
                    }}
                  />

                  <PD.SchemaFetcher
                    schemaUrl={R.pathOr('', ['schema', 'url'], values.workflow)}
                  >
                    {AsyncResult.case({
                      Ok: ({ responseError, schema, validate }) => (
                        <RF.Field
                          className={classes.meta}
                          component={PD.MetaInput}
                          name="meta"
                          bucket={bucket}
                          schema={schema}
                          schemaError={responseError}
                          validate={validate}
                          validateFields={['meta']}
                          isEqual={R.equals}
                          initialValue={initialMeta}
                        />
                      ),
                      _: () => <PD.MetaInputSkeleton className={classes.meta} />,
                    })}
                  </PD.SchemaFetcher>

                  <RF.Field
                    component={PD.WorkflowInput}
                    name="workflow"
                    workflowsConfig={workflowsConfig}
                    initialValue={initialWorkflow}
                    validateFields={['meta', 'workflow']}
                  />
                </M.Grid>

                <M.Grid item xs={12} sm={6}>
                  <RF.Field
                    className={classes.files}
                    component={FilesInput}
                    name="files"
                    validate={validators.nonEmpty}
                    validateFields={['files']}
                    errors={{
                      nonEmpty: 'Add files to create a package',
                    }}
                    uploads={uploads}
                    onFilesAction={onFilesAction}
                    isEqual={R.equals}
                    initialValue={initialFiles}
                  />
                </M.Grid>
              </M.Grid>

              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && (
              <Delay ms={200} alwaysRender>
                {(ready) => (
                  <M.Fade in={ready}>
                    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                      <M.CircularProgress
                        size={24}
                        variant={
                          totalProgress.percent < 100 ? 'determinate' : 'indeterminate'
                        }
                        value={
                          totalProgress.percent < 100
                            ? totalProgress.percent * 0.9
                            : undefined
                        }
                      />
                      <M.Box pl={1} />
                      <M.Typography variant="body2" color="textSecondary">
                        {totalProgress.percent < 100
                          ? 'Uploading files'
                          : 'Writing manifest'}
                      </M.Typography>
                    </M.Box>
                  </M.Fade>
                )}
              </Delay>
            )}

            {!submitting && (!!error || !!submitError) && (
              <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                <M.Icon color="error">error_outline</M.Icon>
                <M.Box pl={1} />
                <M.Typography variant="body2" color="error">
                  {error || submitError}
                </M.Typography>
              </M.Box>
            )}

            <M.Button onClick={close} disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              disabled={submitting || (submitFailed && hasValidationErrors)}
            >
              Push
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

function DialogPlaceholder({ close }) {
  return (
    <>
      <M.DialogTitle>Push package revision</M.DialogTitle>
      <M.DialogContent style={{ paddingTop: 0 }}>
        <PD.FormSkeleton />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close}>Cancel</M.Button>
        <M.Button variant="contained" color="primary" disabled>
          Push
        </M.Button>
      </M.DialogActions>
    </>
  )
}

function DialogError({ error, close }) {
  return (
    <PD.DialogError
      error={error}
      skeletonElement={<PD.FormSkeleton animate={false} />}
      title="Push package revision"
      onCancel={close}
    />
  )
}

function DialogSuccess({ bucket, name, hash, close }) {
  const { urls } = NamedRoutes.use()
  return (
    <>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent style={{ paddingTop: 0 }}>
        <M.Typography>
          Package revision{' '}
          <StyledLink to={urls.bucketPackageTree(bucket, name, hash)}>
            {name}@{R.take(10, hash)}
          </StyledLink>{' '}
          successfully created
        </M.Typography>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close}>Close</M.Button>
        <M.Button
          component={Link}
          to={urls.bucketPackageTree(bucket, name, hash)}
          variant="contained"
          color="primary"
        >
          Browse
        </M.Button>
      </M.DialogActions>
    </>
  )
}

function DialogWrapper({ exited, ...props }) {
  const ref = React.useRef()
  ref.current = { exited, onExited: props.onExited }
  React.useEffect(
    () => () => {
      // call onExited on unmount if it has not been called yet
      if (!ref.current.exited && ref.current.onExited) ref.current.onExited()
    },
    [],
  )
  return <M.Dialog {...props} />
}

const DialogState = tagged([
  'Closed',
  'Loading',
  'Error',
  'Form', // { manifest, workflowsConfig }
  'Success', // { name, hash }
])

export function usePackageUpdateDialog({ bucket, name, hash, onExited }) {
  const s3 = AWS.S3.use()

  const [isOpen, setOpen] = React.useState(false)
  const [wasOpened, setWasOpened] = React.useState(false)
  const [exited, setExited] = React.useState(!isOpen)
  const [success, setSuccess] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [key, setKey] = React.useState(1)

  const manifestData = Data.use(
    requests.loadManifest,
    { s3, bucket, name, hash, key },
    { noAutoFetch: !wasOpened },
  )
  const workflowsData = Data.use(requests.workflowsList, { s3, bucket })

  const open = React.useCallback(() => {
    setOpen(true)
    setWasOpened(true)
    setExited(false)
  }, [setOpen, setWasOpened, setExited])

  const close = React.useCallback(() => {
    if (submitting) return
    setOpen(false)
  }, [submitting, setOpen])

  const refreshManifest = React.useCallback(() => {
    setWasOpened(false)
    setKey(R.inc)
  }, [setWasOpened, setKey])

  const handleExited = React.useCallback(() => {
    setExited(true)
    setSuccess(false)
    if (onExited) {
      const shouldRefreshManifest = onExited({ pushed: success })
      if (shouldRefreshManifest) refreshManifest()
    }
  }, [setExited, setSuccess, success, onExited, refreshManifest])

  const state = React.useMemo(() => {
    if (exited) return DialogState.Closed()
    if (success) return DialogState.Success(success)
    return workflowsData.case({
      Ok: (workflowsConfig) =>
        manifestData.case({
          Ok: (manifest) => DialogState.Form({ manifest, workflowsConfig }),
          Err: DialogState.Error,
          _: DialogState.Loading,
        }),
      Err: DialogState.Error,
      _: DialogState.Loading,
    })
  }, [exited, success, workflowsData, manifestData])

  const stateCase = React.useCallback((cases) => DialogState.case(cases, state), [state])

  const render = React.useCallback(
    () => (
      <DialogWrapper
        exited={exited}
        fullWidth
        maxWidth="lg"
        onClose={close}
        onExited={handleExited}
        open={isOpen}
        scroll="body"
      >
        {stateCase({
          Closed: () => null,
          Loading: () => <DialogPlaceholder close={close} />,
          Error: (e) => <DialogError close={close} error={e} />,
          Form: (props) => (
            <DialogForm
              {...{
                bucket,
                name,
                close,
                onSuccess: setSuccess,
                setSubmitting,
                ...props,
              }}
            />
          ),
          Success: (props) => <DialogSuccess {...{ bucket, close, ...props }} />,
        })}
      </DialogWrapper>
    ),
    [bucket, name, isOpen, exited, close, stateCase, handleExited],
  )

  return React.useMemo(() => ({ open, close, render }), [open, close, render])
}

export const use = usePackageUpdateDialog
