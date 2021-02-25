import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as M from '@material-ui/core'

import { readableBytes } from 'utils/string'
import * as tagged from 'utils/taggedV2'
import useMemoEq from 'utils/useMemoEq'

import * as PD from './PackageDialog'

const COLORS = {
  default: M.colors.grey[900],
  added: M.colors.green[900],
  modified: M.darken(M.colors.yellow[900], 0.2),
  deleted: M.colors.red[900],
}

export const FilesAction = tagged.create(
  'app/containers/Bucket/PackageDialog/FilesInput:FilesAction' as const,
  {
    Add: (v: { files: File[]; prefix?: string }) => v,
    Delete: (path: string) => path,
    DeleteDir: (prefix: string) => prefix,
    Revert: (path: string) => path,
    RevertDir: (prefix: string) => prefix,
    Reset: () => {},
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FilesAction = tagged.InstanceOf<typeof FilesAction>

// XXX: this looks more like a manifest entry, so we probably should move this out to a more appropriate place
export interface ExistingFile {
  hash: string
  meta: {}
  physicalKey: string
  size: number
  // TODO: this was added as an ad hoc workaround to display directories in PackageDirectoryDialog.
  // We should consider changing this design, bc it breaks the consistency of the model.
  isDir?: boolean
}

export interface FilesState {
  added: Record<string, File>
  deleted: Record<string, true>
  existing: Record<string, ExistingFile>
}

interface FilesStateTransformer {
  (state: FilesState): FilesState
}

const dissocBy = (fn: (key: string) => boolean) =>
  R.pipe(
    // @ts-expect-error
    R.toPairs,
    R.filter(([k]) => !fn(k)),
    R.fromPairs,
  ) as { <T>(obj: Record<string, T>): Record<string, T> }

const handleFilesAction = FilesAction.match<
  FilesStateTransformer,
  [{ initial: FilesState }]
>({
  Add: ({ files, prefix }) => (state) =>
    files.reduce((acc, file) => {
      const path = (prefix || '') + (PD.getNormalizedPath as (f: File) => string)(file)
      return R.evolve(
        {
          added: R.assoc(path, file),
          deleted: R.dissoc(path),
        },
        acc,
      ) as FilesState
    }, state),
  Delete: (path) => R.evolve({ deleted: R.assoc(path, true) }) as FilesStateTransformer,
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
  Revert: (path) =>
    R.evolve({ added: R.dissoc(path), deleted: R.dissoc(path) }) as FilesStateTransformer,
  // remove all descendants from added and deleted
  RevertDir: (prefix) =>
    R.evolve({
      added: dissocBy(R.startsWith(prefix)),
      deleted: dissocBy(R.startsWith(prefix)),
    }) as FilesStateTransformer,
  Reset: (_, { initial }) => () => initial,
})

interface DispatchFilesAction {
  (action: FilesAction): void
}

type FilesEntryType = 'deleted' | 'modified' | 'unchanged' | 'unchanged' | 'added'

const FilesEntryTag = 'app/containers/Bucket/PackageDialog/FilesInput:FilesEntry' as const

const FilesEntry = tagged.create(FilesEntryTag, {
  Dir: (v: {
    disabled?: boolean
    name: string
    type: FilesEntryType
    contentIsUnknown?: boolean
    children: tagged.Instance<typeof FilesEntryTag>[]
  }) => v,
  File: (v: { disabled?: boolean; name: string; type: FilesEntryType; size: number }) =>
    v,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
type FilesEntry = tagged.InstanceOf<typeof FilesEntry>
type FilesEntryDir = ReturnType<typeof FilesEntry.Dir>

const insertIntoDir = (path: string[], file: FilesEntry, dir: FilesEntryDir) => {
  const { name, children } = FilesEntry.Dir.unbox(dir)
  const newChildren = insertIntoTree(path, file, children)
  const type = newChildren
    .map(FilesEntry.match({ Dir: R.prop('type'), File: R.prop('type') }))
    .reduce((acc, entryType) => (acc === entryType ? acc : 'modified'))
  return FilesEntry.Dir({ name, type, children: newChildren })
}

const insertIntoTree = (path: string[] = [], file: FilesEntry, entries: FilesEntry[]) => {
  let inserted = file
  let restEntries = entries
  if (path.length) {
    const [current, ...rest] = path
    const type = FilesEntry.match({ File: (f) => f.type, Dir: (d) => d.type }, file)
    let baseDir = FilesEntry.Dir({ name: current, type, children: [] })
    const existingDir = entries.find(
      FilesEntry.match({
        File: () => false,
        Dir: R.propEq('name', current),
      }),
    )
    if (existingDir) {
      restEntries = R.without([existingDir], entries)
      baseDir = existingDir as FilesEntryDir
    }
    inserted = insertIntoDir(rest, file, baseDir)
  }
  const sort = R.sortWith([
    R.ascend(FilesEntry.match({ Dir: () => 0, File: () => 1 })),
    R.ascend(FilesEntry.match({ Dir: (d) => d.name, File: (f) => f.name })),
  ])
  return sort([inserted, ...restEntries])
}

interface IntermediateEntry {
  type: FilesEntryType
  path: string
  size: number
  isDir?: boolean
}

const computeEntries = ({ added, deleted, existing }: FilesState) => {
  const existingEntries = Object.entries(existing).map(([path, { isDir, size }]) => {
    if (path in deleted) {
      return { type: 'deleted' as const, path, size }
    }
    if (path in added) {
      const a = added[path]
      return { type: 'modified' as const, path, size: a.size }
    }
    if (isDir) {
      return { type: 'unchanged' as const, path, size, isDir }
    }
    return { type: 'unchanged' as const, path, size }
  })
  const addedEntries = Object.entries(added).reduce((acc, [path, { size }]) => {
    if (path in existing) return acc
    return acc.concat({ type: 'added', path, size })
  }, [] as IntermediateEntry[])
  const entries: IntermediateEntry[] = [...existingEntries, ...addedEntries]
  return entries.reduce((children, { path, ...rest }) => {
    const parts = path.split('/')
    const prefixPath = R.init(parts).map((p) => `${p}/`)
    const name = R.last(parts)!
    const file = rest.isDir
      ? FilesEntry.Dir({ name, contentIsUnknown: true, children: [], ...rest })
      : FilesEntry.File({ name, ...rest })
    return insertIntoTree(prefixPath, file, children)
  }, [] as FilesEntry[])
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

type EntryIconProps = React.PropsWithChildren<{ state: FilesEntryType }>

function EntryIcon({ state, children }: EntryIconProps) {
  const classes = useEntryIconStyles()
  const stateContents =
    state &&
    {
      added: '+',
      deleted: <>&ndash;</>,
      modified: '~',
      unchanged: undefined,
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
  disabled: {
    color: t.palette.text.disabled,
    cursor: 'not-allowed',
  },
  contents: {
    alignItems: 'center',
    display: 'flex',
    opacity: 0.7,
    '$root:hover > &': {
      opacity: 1,
    },
    '$disabled &': {
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

type FileProps = tagged.ValueOf<typeof FilesEntry.File> & {
  prefix?: string
  dispatch: DispatchFilesAction
}

function File({ disabled, name, type, size, prefix, dispatch }: FileProps) {
  const classes = useFileStyles()

  const path = (prefix || '') + name

  const handle = React.useCallback(
    (cons: tagged.ConstructorOf<typeof FilesAction>) => (e: React.MouseEvent) => {
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

  const onClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={cx(classes.root, classes[type], { [classes.disabled]: disabled })}
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
        {!disabled && (
          <M.IconButton onClick={action.handler} title={action.hint} size="small">
            <M.Icon fontSize="inherit">{action.icon}</M.Icon>
          </M.IconButton>
        )}
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
  disabled: {
    cursor: 'not-allowed',
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
    '$disabled &': {
      color: t.palette.text.disabled,
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

type DirProps = tagged.ValueOf<typeof FilesEntry.Dir> & {
  prefix?: string
  dispatch: DispatchFilesAction
}

function Dir({
  contentIsUnknown,
  disabled,
  name,
  type,
  children,
  prefix,
  dispatch,
}: DirProps) {
  const classes = useDirStyles()
  // TODO: move state out?
  const [expanded, setExpanded] = React.useState(true)

  const toggleExpanded = React.useCallback(
    (e) => {
      e.stopPropagation()
      if (disabled) return
      setExpanded((x) => !x)
    },
    [disabled, setExpanded],
  )

  const onClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const path = (prefix || '') + name

  const onDrop = React.useCallback(
    (files: File[]) => {
      dispatch(FilesAction.Add({ prefix: path, files }))
    },
    [dispatch, path],
  )

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    noDragEventsBubbling: true,
  })

  const handle = React.useCallback(
    (cons: tagged.ConstructorOf<typeof FilesAction>) => (e: React.MouseEvent) => {
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
        className: cx(classes.root, classes[type], {
          [classes.active]: isDragActive,
          [classes.disabled]: disabled,
        }),
        onClick,
      })}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div onClick={toggleExpanded} className={classes.head} role="button" tabIndex={0}>
        <EntryIcon state={type}>{expanded ? 'folder_open' : 'folder'}</EntryIcon>
        <div className={classes.name}>{name}</div>
        {!disabled && (
          <M.IconButton onClick={action.handler} title={action.hint} size="small">
            <M.Icon fontSize="inherit">{action.icon}</M.Icon>
          </M.IconButton>
        )}
        {!contentIsUnknown && (
          <>
            <div className={classes.bar} />
            {!children.length && (
              <div className={classes.empty}>{'<EMPTY DIRECTORY>'}</div>
            )}
          </>
        )}
      </div>
      {!contentIsUnknown && (
        <M.Collapse in={expanded}>
          <div className={classes.body}>
            {children.length ? (
              children.map(
                FilesEntry.match({
                  Dir: (ps) => (
                    <Dir {...ps} key={ps.name} prefix={path} dispatch={dispatch} />
                  ),
                  File: (ps) => (
                    <File {...ps} key={ps.name} prefix={path} dispatch={dispatch} />
                  ),
                }),
              )
            ) : (
              <div className={classes.emptyDummy} />
            )}
          </div>
        </M.Collapse>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
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
    overflowY: 'auto',
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
  filesContainer: {
    direction: 'rtl', // show the scrollbar on the left
    borderBottom: `1px solid ${t.palette.action.disabled}`,
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

const useDropdownMessageStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    padding: t.spacing(1, 0),
    textAlign: 'center',
  },
  disabled: {
    padding: 0,
  },
  error: {
    color: t.palette.error.main,
  },
  warning: {
    color: t.palette.warning.dark,
  },
}))

interface DropdownMessageProps {
  error: React.ReactNode
  warn: boolean
  disabled: boolean
}

function DropdownMessage({ error, warn, disabled }: DropdownMessageProps) {
  const classes = useDropdownMessageStyles()

  const label = React.useMemo(() => {
    if (error) return error
    if (warn)
      return (
        <>
          Total size of new files exceeds recommended maximum of{' '}
          {readableBytes(PD.MAX_SIZE)}
        </>
      )
    if (disabled) return ''
    return 'Drop files here or click to browse'
  }, [error, warn, disabled])

  return (
    <div
      className={cx(classes.root, {
        [classes.disabled]: disabled,
        [classes.error]: error,
        [classes.warning]: !error && warn,
      })}
    >
      <span>{label}</span>
    </div>
  )
}

interface FilesInputProps {
  input: {
    value: FilesState
    onChange: (value: FilesState) => void
  }
  className?: string
  disabled?: boolean
  errors?: Record<string, React.ReactNode>
  meta: {
    submitting: boolean
    submitSucceeded: boolean
    submitFailed: boolean
    dirty: boolean
    error?: string
    initial: FilesState
  }
  onFilesAction?: (
    action: FilesAction,
    oldValue: FilesState,
    newValue: FilesState,
  ) => void
  title: React.ReactNode
  totalProgress: {
    total: number
    loaded: number
    percent: number
  }
}

export function FilesInput({
  input: { value, onChange },
  className,
  disabled = false,
  errors = {},
  meta,
  onFilesAction,
  title,
  totalProgress,
}: FilesInputProps) {
  const classes = useStyles()

  const submitting = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const totalSize = React.useMemo(
    () => Object.values(value.added).reduce((sum, f) => sum + f.size, 0),
    [value.added],
  )

  const warn = totalSize > PD.MAX_SIZE

  const refProps = {
    value,
    disabled: disabled || submitting,
    initial: meta.initial,
    onChange,
    onFilesAction,
  }
  const ref = React.useRef<typeof refProps>()
  ref.current = refProps
  const { current: dispatch } = React.useRef((action: FilesAction) => {
    const cur = ref.current!
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
            submitting || disabled // eslint-disable-line no-nested-ternary
              ? classes.headerFilesDisabled
              : error // eslint-disable-line no-nested-ternary
              ? classes.headerFilesError
              : warn
              ? classes.headerFilesWarn
              : undefined,
          )}
        >
          {title}
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
            disabled={ref.current.disabled}
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
              isDragActive && !ref.current.disabled && classes.active,
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
                {computedEntries.map(
                  FilesEntry.match({
                    Dir: (ps) => (
                      <Dir
                        {...ps}
                        key={`dir:${ps.name}`}
                        dispatch={dispatch}
                        disabled={disabled}
                      />
                    ),
                    File: (ps) => (
                      <File
                        {...ps}
                        key={`file:${ps.name}`}
                        dispatch={dispatch}
                        disabled={disabled}
                      />
                    ),
                  }),
                )}
              </div>
            </div>
          )}

          <DropdownMessage
            error={error && (errors[error] || error)}
            warn={warn}
            disabled={disabled}
          />
        </div>
        {submitting && (
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

export default FilesInput
