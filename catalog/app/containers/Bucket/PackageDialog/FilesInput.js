import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as M from '@material-ui/core'

import { readableBytes } from 'utils/string'
import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'

import * as PD from './PackageDialog'

const COLORS = {
  default: M.colors.grey[900],
  added: M.colors.green[900],
  modified: M.darken(M.colors.yellow[900], 0.2),
  deleted: M.colors.red[900],
}

const FilesAction = tagged([
  'Add', // { files: [File], prefix: str }
  'Delete', // path: str
  'DeleteDir', // prefix: str
  'Revert', // path: str
  'RevertDir', // prefix: str
  'Reset',
])

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
    display: 'flex',
    flexDirection: 'column',
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
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    marginTop: t.spacing(2),
    position: 'relative',
  },
  dropzone: {
    background: t.palette.action.hover,
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
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
    maxHeight: t.spacing(68),
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

const FilesEntry = tagged([
  'Dir', // { name: str, type: enum, children: [FilesEntry] }
  'File', // { name: str, type: enum, size: num }
])

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

export default function FilesInput({
  input: { value, onChange },
  className,
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
    <div className={cx(classes.root, className)}>
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
