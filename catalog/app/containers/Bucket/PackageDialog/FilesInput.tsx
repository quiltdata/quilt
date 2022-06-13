import cx from 'classnames'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone, FileWithPath } from 'react-dropzone'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import { fade } from '@material-ui/core/styles'

import * as urls from 'constants/urls'
import * as Model from 'model'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import dissocBy from 'utils/dissocBy'
import useDragging from 'utils/dragging'
import { withoutPrefix } from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import * as tagged from 'utils/taggedV2'
import useMemoEq from 'utils/useMemoEq'
import * as Types from 'utils/types'

import EditFileMeta from './EditFileMeta'
import * as PD from './PackageDialog'
import * as S3FilePicker from './S3FilePicker'

const COLORS = {
  default: M.colors.grey[900],
  added: M.colors.green[900],
  modified: M.darken(M.colors.yellow[900], 0.2),
  deleted: M.colors.red[900],
}

interface FileWithHash extends File {
  hash: {
    ready: boolean
    value?: string
    error?: Error
    promise: Promise<string | undefined>
  }
  meta?: Types.JsonRecord
}

const hasHash = (f: File): f is FileWithHash => !!f && !!(f as FileWithHash).hash

const hashLimit = pLimit(2)

function computeHash(f: File) {
  if (hasHash(f)) return f
  const hashP = hashLimit(PD.hashFile, f)
  const fh = f as FileWithHash
  fh.hash = { ready: false } as any
  fh.hash.promise = hashP
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.log(`Error hashing file "${fh.name}":`)
      // eslint-disable-next-line no-console
      console.error(e)
      fh.hash.error = e
      fh.hash.ready = true
      return undefined
    })
    .then((hash) => {
      fh.hash.value = hash
      fh.hash.ready = true
      return hash
    })
  return fh
}

export const FilesAction = tagged.create(
  'app/containers/Bucket/PackageDialog/FilesInput:FilesAction' as const,
  {
    Add: (v: { files: FileWithHash[]; prefix?: string }) => v,
    AddFromS3: (v: {
      files: S3FilePicker.S3File[]
      basePrefix: string
      prefix?: string
    }) => v,
    Delete: (path: string) => path,
    DeleteDir: (prefix: string) => prefix,
    Meta: (v: { path: string; meta: Types.JsonRecord }) => v,
    Revert: (path: string) => path,
    RevertDir: (prefix: string) => prefix,
    Reset: () => {},
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FilesAction = tagged.InstanceOf<typeof FilesAction>

export type LocalFile = FileWithPath & FileWithHash

export interface FilesState {
  added: Record<string, LocalFile | S3FilePicker.S3File>
  deleted: Record<string, true>
  existing: Record<string, Model.PackageEntry>
  // XXX: workaround used to re-trigger validation and dependent computations
  // required due to direct mutations of File objects
  counter?: number
}

const addMetaToFile = (
  file: Model.PackageEntry | LocalFile | S3FilePicker.S3File,
  meta: Types.JsonRecord,
) => {
  if (file instanceof window.File) {
    const fileCopy = new window.File([file as File], (file as File).name, {
      type: (file as File).type,
    })
    Object.defineProperty(fileCopy, 'meta', {
      value: meta,
    })
    Object.defineProperty(fileCopy, 'hash', {
      value: (file as FileWithHash).hash,
    })
    return fileCopy
  }
  return R.assoc('meta', meta, file)
}

const handleFilesAction = FilesAction.match<
  (state: FilesState) => FilesState,
  [{ initial: FilesState }]
>({
  Add:
    ({ files, prefix }) =>
    (state) =>
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
  AddFromS3:
    ({ files, basePrefix, prefix }) =>
    (state) =>
      files.reduce((acc, file) => {
        const path = (prefix || '') + withoutPrefix(basePrefix, file.key)
        return R.evolve(
          {
            added: R.assoc(path, file),
            deleted: R.dissoc(path),
          },
          acc,
        )
      }, state),
  Delete: (path) =>
    R.evolve({
      added: R.dissoc(path),
      deleted: R.assoc(path, true as const),
    }),
  // add all descendants from existing to deleted
  DeleteDir:
    (prefix) =>
    ({ existing, added, deleted, ...rest }) => ({
      existing,
      added: dissocBy(R.startsWith(prefix))(added),
      deleted: R.mergeLeft(
        Object.keys(existing).reduce(
          (acc, k) => (k.startsWith(prefix) ? { ...acc, [k]: true } : acc),
          {},
        ),
        deleted,
      ),
      ...rest,
    }),
  Meta: ({ path, meta }) => {
    const mkSetMeta =
      <T extends Model.PackageEntry | LocalFile | S3FilePicker.S3File>() =>
      (filesDict: Record<string, T>) => {
        const file = filesDict[path]
        if (!file) return filesDict
        return R.assoc(path, addMetaToFile(file, meta), filesDict)
      }
    return R.evolve({
      added: mkSetMeta<LocalFile | S3FilePicker.S3File>(),
      existing: mkSetMeta<Model.PackageEntry>(),
    })
  },
  Revert: (path) => R.evolve({ added: R.dissoc(path), deleted: R.dissoc(path) }),
  // remove all descendants from added and deleted
  RevertDir: (prefix) =>
    R.evolve({
      added: dissocBy(R.startsWith(prefix)),
      deleted: dissocBy(R.startsWith(prefix)),
    }),
  Reset:
    (_, { initial }) =>
    () =>
      initial,
})

interface DispatchFilesAction {
  (action: FilesAction): void
}

type FilesEntryState = 'deleted' | 'modified' | 'unchanged' | 'hashing' | 'added'

type FilesEntryType = 's3' | 'local'

const FilesEntryTag = 'app/containers/Bucket/PackageDialog/FilesInput:FilesEntry' as const

const FilesEntry = tagged.create(FilesEntryTag, {
  Dir: (v: {
    name: string
    state: FilesEntryState
    childEntries: tagged.Instance<typeof FilesEntryTag>[]
  }) => v,
  File: (v: {
    name: string
    state: FilesEntryState
    type: FilesEntryType
    size: number
    meta?: Types.JsonRecord | null
  }) => v,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
type FilesEntry = tagged.InstanceOf<typeof FilesEntry>
type FilesEntryDir = ReturnType<typeof FilesEntry.Dir>

const insertIntoDir = (path: string[], file: FilesEntry, dir: FilesEntryDir) => {
  const { name, childEntries } = FilesEntry.Dir.unbox(dir)
  const newChildren = insertIntoTree(path, file, childEntries)
  const state = newChildren
    .map(FilesEntry.match({ Dir: R.prop('state'), File: R.prop('state') }))
    .reduce((acc, entryState) => {
      if (entryState === 'hashing' || acc === 'hashing') return 'hashing'
      if (acc === entryState) return acc
      return 'modified'
    })
  return FilesEntry.Dir({ name, state, childEntries: newChildren })
}

// eslint-disable-next-line @typescript-eslint/default-param-last
const insertIntoTree = (path: string[] = [], file: FilesEntry, entries: FilesEntry[]) => {
  let inserted = file
  let restEntries = entries
  if (path.length) {
    const [current, ...rest] = path
    const state = FilesEntry.match({ File: (f) => f.state, Dir: (d) => d.state }, file)
    let baseDir = FilesEntry.Dir({ name: current, state, childEntries: [] })
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
  state: FilesEntryState
  type: FilesEntryType
  path: string
  size: number
  meta?: Types.JsonRecord | null
}

const computeEntries = ({ added, deleted, existing }: FilesState) => {
  const existingEntries: IntermediateEntry[] = Object.entries(existing).map(
    ([path, { size, hash, meta }]) => {
      if (path in deleted) {
        return { state: 'deleted' as const, type: 'local' as const, path, size, meta }
      }
      if (path in added) {
        const a = added[path]
        let state: FilesEntryState
        let type: FilesEntryType
        if (S3FilePicker.isS3File(a)) {
          type = 's3' as const
          state = 'modified' as const
        } else {
          type = 'local' as const
          // eslint-disable-next-line no-nested-ternary
          state = !a.hash.ready
            ? ('hashing' as const)
            : a.hash.value === hash
            ? ('unchanged' as const)
            : ('modified' as const)
        }
        return { state, type, path, size: a.size, meta }
      }
      return { state: 'unchanged' as const, type: 'local' as const, path, size, meta }
    },
  )
  const addedEntries = Object.entries(added).reduce((acc, [path, f]) => {
    if (path in existing) return acc
    const type = S3FilePicker.isS3File(f) ? ('s3' as const) : ('local' as const)
    return acc.concat({ state: 'added', type, path, size: f.size, meta: f.meta })
  }, [] as IntermediateEntry[])
  const entries: IntermediateEntry[] = [...existingEntries, ...addedEntries]
  return entries.reduce((children, { path, ...rest }) => {
    const parts = path.split('/')
    const prefixPath = R.init(parts).map((p) => `${p}/`)
    const name = R.last(parts)!
    const file = FilesEntry.File({ name, ...rest })
    return insertIntoTree(prefixPath, file, children)
  }, [] as FilesEntry[])
}

export const HASHING = 'hashing'
export const HASHING_ERROR = 'hashingError'

export const validateHashingComplete = (state: FilesState) => {
  const files = Object.values(state.added).filter(
    (f) => !S3FilePicker.isS3File(f),
  ) as FileWithHash[]
  if (files.some((f) => f.hash.ready && !f.hash.value)) return HASHING_ERROR
  if (files.some((f) => !f.hash.ready)) return HASHING
  return undefined
}

export const EMPTY_SELECTION = 'emptySelection'

export const validateNonEmptySelection = (state: FilesSelectorState) => {
  if (state.every(R.propEq('selected', false))) return EMPTY_SELECTION
  return undefined
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
  overlay: {
    alignItems: 'center',
    bottom: 0,
    color: t.palette.background.paper,
    display: 'flex',
    fontFamily: t.typography.fontFamily,
    fontSize: 8,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
  hashProgress: {
    color: t.palette.background.paper,
  },
}))

type EntryIconProps = React.PropsWithChildren<{
  state: FilesEntryState
  overlay?: React.ReactNode
}>

function EntryIcon({ state, overlay, children }: EntryIconProps) {
  const classes = useEntryIconStyles()
  const stateContents = {
    added: '+',
    deleted: <>&ndash;</>,
    modified: '~',
    hashing: 'hashing',
    unchanged: undefined,
  }[state]
  return (
    <div className={classes.root}>
      <M.Icon className={classes.icon}>{children}</M.Icon>
      {!!overlay && <div className={classes.overlay}>{overlay}</div>}
      {!!stateContents && (
        <div className={classes.stateContainer}>
          {stateContents === 'hashing' ? (
            <M.CircularProgress size={8} thickness={6} className={classes.hashProgress} />
          ) : (
            <div className={classes.state}>{stateContents}</div>
          )}
        </div>
      )}
    </div>
  )
}

const useFileStyles = M.makeStyles((t) => ({
  added: {},
  modified: {},
  hashing: {},
  deleted: {},
  unchanged: {},
  interactive: {},
  root: {
    alignItems: 'center',
    color: COLORS.default,
    cursor: 'default',
    display: 'flex',
    opacity: 0.7,
    outline: 'none',
    '&:hover': {
      opacity: 1,
    },
    '&$added': {
      color: COLORS.added,
    },
    '&$modified': {
      color: COLORS.modified,
    },
    '&$hashing': {
      color: COLORS.modified,
    },
    '&$deleted': {
      color: COLORS.deleted,
    },
    '&$interactive': {
      cursor: 'pointer',
    },
  },
  inner: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden',
  },
  faint: {
    opacity: 0.5,
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

interface FileProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  state?: FilesEntryState
  type?: FilesEntryType
  size?: number
  action?: React.ReactNode
  meta?: Types.JsonRecord | null
  metaDisabled?: boolean
  onMeta?: (value: Types.JsonRecord) => void
  interactive?: boolean
  faint?: boolean
  disableStateDisplay?: boolean
}

function File({
  name,
  state = 'unchanged',
  type = 'local',
  size,
  action,
  meta,
  metaDisabled,
  onMeta,
  interactive = false,
  faint = false,
  className,
  disableStateDisplay = false,
  ...props
}: FileProps) {
  const classes = useFileStyles()
  const stateDisplay = disableStateDisplay ? 'unchanged' : state

  // XXX: reset EditFileMeta state when file is reverted
  const metaKey = React.useMemo(() => JSON.stringify(meta), [meta])

  return (
    <div
      className={cx(
        className,
        classes.root,
        classes[stateDisplay],
        interactive && classes.interactive,
      )}
      {...props}
    >
      <div className={cx(classes.inner, faint && classes.faint)}>
        <EntryIcon state={stateDisplay} overlay={type === 's3' ? 'S3' : undefined}>
          insert_drive_file
        </EntryIcon>
        <div className={classes.name} title={name}>
          {name}
        </div>
        {size != null && <div className={classes.size}>{readableBytes(size)}</div>}
      </div>
      <EditFileMeta
        disabled={metaDisabled}
        key={metaKey}
        name={name}
        onChange={onMeta}
        value={meta}
      />
      {action}
    </div>
  )
}

const useDirStyles = M.makeStyles((t) => ({
  added: {},
  modified: {},
  hashing: {},
  deleted: {},
  unchanged: {},
  active: {},
  root: {
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
    '$hashing > &': {
      color: COLORS.modified,
    },
    '$deleted > &': {
      color: COLORS.deleted,
    },
  },
  headInner: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden',
  },
  faint: {
    opacity: 0.5,
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

interface DirProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  state?: FilesEntryState
  disableStateDisplay?: boolean
  active?: boolean
  empty?: boolean
  expanded?: boolean
  faint?: boolean
  onChangeExpanded?: (expanded: boolean) => void
  action?: React.ReactNode
  onHeadClick?: React.MouseEventHandler<HTMLDivElement>
}

export const Dir = React.forwardRef<HTMLDivElement, DirProps>(function Dir(
  {
    name,
    state = 'unchanged',
    disableStateDisplay = false,
    active = false,
    empty = false,
    expanded = false,
    faint = false,
    action,
    className,
    onHeadClick,
    children,
    ...props
  },
  ref,
) {
  const classes = useDirStyles()
  const stateDisplay = disableStateDisplay ? 'unchanged' : state

  return (
    <div
      className={cx(className, classes.root, classes[stateDisplay], {
        [classes.active]: active,
      })}
      ref={ref}
      {...props}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div onClick={onHeadClick} className={classes.head} role="button" tabIndex={0}>
        <div className={cx(classes.headInner, faint && classes.faint)}>
          <EntryIcon state={stateDisplay}>
            {expanded ? 'folder_open' : 'folder'}
          </EntryIcon>
          <div className={classes.name}>{name}</div>
        </div>
        {action}
        {(!!children || empty) && (
          <>
            <div className={classes.bar} />
            {empty && <div className={classes.empty}>{'<EMPTY DIRECTORY>'}</div>}
          </>
        )}
      </div>
      {(!!children || empty) && (
        <M.Collapse in={expanded} mountOnEnter unmountOnExit>
          <div className={classes.body}>
            {children || <div className={classes.emptyDummy} />}
          </div>
        </M.Collapse>
      )}
    </div>
  )
})

const useDropzoneMessageStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.action.hover,
    cursor: 'pointer',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    padding: t.spacing(6, 0),
    textAlign: 'center',
  },
  error: {
    color: t.palette.error.main,
  },
  warning: {
    color: t.palette.warning.dark,
  },
}))

interface DropzoneMessageProps {
  label?: React.ReactNode
  error: React.ReactNode
  warn: { upload: boolean; s3: boolean; count: boolean }
}

export function DropzoneMessage({
  label: defaultLabel,
  error,
  warn,
}: DropzoneMessageProps) {
  const classes = useDropzoneMessageStyles()

  const label = React.useMemo(() => {
    if (error) return <span>{error}</span>
    if (!warn.s3 && !warn.count && !warn.upload) {
      return <span>{defaultLabel || 'Drop files here or click to browse'}</span>
    }
    return (
      <div>
        {warn.upload && (
          <p>
            Total size of local files exceeds recommended maximum of{' '}
            {readableBytes(PD.MAX_UPLOAD_SIZE)}.
          </p>
        )}
        {warn.s3 && (
          <p>
            Total size of files from S3 exceeds recommended maximum of{' '}
            {readableBytes(PD.MAX_S3_SIZE)}.
          </p>
        )}
        {warn.count && (
          <p>Total number of files exceeds recommended maximum of {PD.MAX_FILE_COUNT}.</p>
        )}
      </div>
    )
  }, [defaultLabel, error, warn.upload, warn.s3, warn.count])

  return (
    <div
      className={cx(classes.root, {
        [classes.error]: error,
        [classes.warning]: !error && (warn.upload || warn.s3 || warn.count),
      })}
    >
      {label}
    </div>
  )
}

const useRootStyles = M.makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
})

export function Root({
  className,
  ...props
}: React.PropsWithChildren<{ className?: string }>) {
  const classes = useRootStyles()
  return <div className={cx(classes.root, className)} {...props} />
}

const useHeaderStyles = M.makeStyles({
  root: {
    display: 'flex',
    height: 24,
  },
})

export function Header(props: React.PropsWithChildren<{}>) {
  const classes = useHeaderStyles()
  return <div className={classes.root} {...props} />
}

const useHeaderTitleStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body1,
    alignItems: 'center',
    display: 'flex',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  regular: {},
  disabled: {
    color: t.palette.text.secondary,
  },
  error: {
    color: t.palette.error.main,
  },
  warn: {
    color: t.palette.warning.dark,
  },
}))

type HeaderTitleState = 'disabled' | 'error' | 'warn' | 'regular'

export function HeaderTitle({
  state = 'regular',
  ...props
}: React.PropsWithChildren<{ state?: HeaderTitleState }>) {
  const classes = useHeaderTitleStyles()
  return <div className={cx(classes.root, classes[state])} {...props} />
}

const PROGRESS_EMPTY = { total: 0, loaded: 0, percent: 0 }

const useLockStyles = M.makeStyles((t) => ({
  root: {
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

export function Lock({
  progress,
}: {
  progress?: {
    total: number
    loaded: number
    percent: number
  }
}) {
  const classes = useLockStyles()
  return (
    <div className={classes.root}>
      {!!progress && (
        <>
          <div className={classes.progressContainer}>
            <M.CircularProgress
              size={80}
              value={progress.total ? progress.percent : undefined}
              variant={progress.total ? 'determinate' : 'indeterminate'}
            />
            {!!progress.total && (
              <div className={classes.progressPercent}>{progress.percent}%</div>
            )}
          </div>
          {!!progress.total && (
            <div className={classes.progressSize}>
              {readableBytes(progress.loaded)}
              {' / '}
              {readableBytes(progress.total)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const useFilesContainerStyles = M.makeStyles((t) => ({
  root: {
    direction: 'rtl', // show the scrollbar on the left
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  border: {
    borderBottom: `1px solid ${t.palette.action.disabled}`,
  },
  err: {
    borderColor: t.palette.error.main,
  },
  warn: {
    borderColor: t.palette.warning.dark,
  },
  inner: {
    direction: 'ltr',
  },
}))

type FilesContainerProps = React.PropsWithChildren<{
  error?: boolean
  warn?: boolean
  noBorder?: boolean
}>

export function FilesContainer({ error, warn, noBorder, children }: FilesContainerProps) {
  const classes = useFilesContainerStyles()
  return (
    <div
      className={cx(
        classes.root,
        !noBorder && classes.border,
        error && classes.err,
        !error && warn && classes.warn,
      )}
    >
      <div className={classes.inner}>{children}</div>
    </div>
  )
}

const useContentsContainerStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    marginTop: t.spacing(2),
    overflowY: 'auto',
    position: 'relative',
  },
  outlined: {
    outline: `2px dashed ${t.palette.primary.light}`,
    outlineOffset: '-2px',
  },
}))

type ContentsContainerProps = {
  outlined?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export function ContentsContainer({
  outlined,
  className,
  ...props
}: ContentsContainerProps) {
  const classes = useContentsContainerStyles()
  return (
    <div
      className={cx(className, classes.root, outlined && classes.outlined)}
      {...props}
    />
  )
}

const useContentsStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 80,
    outline: 'none',
    overflow: 'hidden',
    position: 'relative',
  },
  interactive: {
    cursor: 'pointer',
  },
  active: {
    background: t.palette.action.selected,
  },
  err: {
    borderColor: t.palette.error.main,
  },
  warn: {
    borderColor: t.palette.warning.dark,
  },
}))

interface ContentsProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  active?: boolean
  error?: boolean
  warn?: boolean
}

export const Contents = React.forwardRef<HTMLDivElement, ContentsProps>(function Contents(
  { interactive, active, error, warn, className, ...props },
  ref,
) {
  const classes = useContentsStyles()
  return (
    <div
      className={cx(
        className,
        classes.root,
        interactive && classes.interactive,
        active && classes.active,
        error && classes.err,
        !error && warn && classes.warn,
      )}
      ref={ref}
      {...props}
    />
  )
})

type FileUploadProps = tagged.ValueOf<typeof FilesEntry.File> & {
  prefix?: string
  disableStateDisplay?: boolean
  dispatch: DispatchFilesAction
}

function FileUpload({
  name,
  state,
  type,
  size,
  prefix,
  disableStateDisplay,
  dispatch,
  meta,
}: FileUploadProps) {
  const path = (prefix || '') + name

  // eslint-disable-next-line consistent-return
  const action = React.useMemo(() => {
    const handle = (a: FilesAction) => (e: React.MouseEvent) => {
      // stop click from propagating to the root element and triggering its handler
      e.stopPropagation()
      dispatch(a)
    }
    switch (state) {
      case 'added':
        return {
          hint: 'Remove',
          icon: 'clear',
          handler: handle(FilesAction.Revert(path)),
        }
      case 'modified':
        return {
          hint: 'Revert',
          icon: 'undo',
          handler: handle(FilesAction.Revert(path)),
        }
      case 'hashing':
        return {
          hint: 'Revert',
          icon: 'undo',
          handler: handle(FilesAction.Revert(path)),
        }
      case 'deleted':
        return {
          hint: 'Restore',
          icon: 'undo',
          handler: handle(FilesAction.Revert(path)),
        }
      case 'unchanged':
        return {
          hint: 'Delete',
          icon: 'clear',
          handler: handle(FilesAction.Delete(path)),
        }
      default:
        assertNever(state)
    }
  }, [state, dispatch, path])

  const onClick = React.useCallback((e: React.MouseEvent) => {
    // stop click from propagating to parent elements and triggering their handlers
    e.stopPropagation()
  }, [])

  const onMeta = React.useCallback(
    (m: Types.JsonRecord) => dispatch(FilesAction.Meta({ path, meta: m })),
    [dispatch, path],
  )

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <File
      onClick={onClick}
      role="button"
      tabIndex={0}
      state={state}
      disableStateDisplay={disableStateDisplay}
      type={type}
      name={name}
      size={size}
      meta={meta}
      metaDisabled={state === 'deleted'}
      onMeta={onMeta}
      action={
        <M.IconButton onClick={action.handler} title={action.hint} size="small">
          <M.Icon fontSize="inherit">{action.icon}</M.Icon>
        </M.IconButton>
      }
    />
  )
}

type DirUploadProps = tagged.ValueOf<typeof FilesEntry.Dir> & {
  prefix?: string
  dispatch: DispatchFilesAction
  delayHashing: boolean
  disableStateDisplay?: boolean
}

function DirUpload({
  name,
  state,
  childEntries,
  prefix,
  dispatch,
  delayHashing,
  disableStateDisplay,
}: DirUploadProps) {
  const [expanded, setExpanded] = React.useState(false)

  const toggleExpanded = React.useCallback(
    (e) => {
      // stop click from propagating to the root element and triggering its handler
      e.stopPropagation()
      setExpanded((x) => !x)
    },
    [setExpanded],
  )

  const onClick = React.useCallback((e: React.MouseEvent) => {
    // stop click from propagating to parent elements and triggering their handlers
    e.stopPropagation()
  }, [])

  const path = (prefix || '') + name

  const onDrop = React.useCallback(
    (files: FileWithPath[]) => {
      // TODO: fix File ⟷ DOMFile ⟷ FileWithHash ⟷ FileWithPath interplay
      // @ts-expect-error
      dispatch(FilesAction.Add({ prefix: path, files: files.map(computeHash) }))
    },
    [dispatch, path],
  )

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    noDragEventsBubbling: true,
    noClick: true,
  })

  // eslint-disable-next-line consistent-return
  const action = React.useMemo(() => {
    const handle = (a: FilesAction) => (e: React.MouseEvent) => {
      // stop click from propagating to the root element and triggering its handler
      e.stopPropagation()
      dispatch(a)
    }
    switch (state) {
      case 'added':
        return {
          hint: 'Remove',
          icon: 'clear',
          handler: handle(FilesAction.RevertDir(path)),
        }
      case 'modified':
        return {
          hint: 'Revert',
          icon: 'undo',
          handler: handle(FilesAction.RevertDir(path)),
        }
      case 'hashing':
        return {
          hint: 'Revert',
          icon: 'undo',
          handler: handle(FilesAction.RevertDir(path)),
        }
      case 'deleted':
        return {
          hint: 'Restore',
          icon: 'undo',
          handler: handle(FilesAction.RevertDir(path)),
        }
      case 'unchanged':
        return {
          hint: 'Delete',
          icon: 'clear',
          handler: handle(FilesAction.DeleteDir(path)),
        }
      default:
        assertNever(state)
    }
  }, [state, dispatch, path])

  return (
    <Dir
      {...getRootProps({ onClick })}
      active={isDragActive}
      onHeadClick={toggleExpanded}
      expanded={expanded}
      name={name}
      state={state}
      disableStateDisplay={disableStateDisplay}
      action={
        <M.IconButton onClick={action.handler} title={action.hint} size="small">
          <M.Icon fontSize="inherit">{action.icon}</M.Icon>
        </M.IconButton>
      }
      empty={!childEntries.length}
    >
      {!!childEntries.length &&
        childEntries.map(
          FilesEntry.match({
            Dir: (ps) => (
              <DirUpload
                {...ps}
                key={ps.name}
                prefix={path}
                dispatch={dispatch}
                delayHashing={delayHashing}
                disableStateDisplay={disableStateDisplay}
              />
            ),
            File: (ps) => (
              <FileUpload
                {...ps}
                key={ps.name}
                prefix={path}
                dispatch={dispatch}
                disableStateDisplay={disableStateDisplay}
              />
            ),
          }),
        )}
    </Dir>
  )
}

const DOCS_URL_SOURCE_BUCKETS = `${urls.docsMaster}/catalog/preferences#properties`

const useFilesInputStyles = M.makeStyles((t) => ({
  hashing: {
    marginLeft: t.spacing(1),
  },
  actions: {
    display: 'flex',
    marginTop: t.spacing(1),
  },
  action: {
    flexGrow: 1,
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  warning: {
    marginLeft: t.spacing(1),
  },
}))

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
  bucket: string
  buckets?: string[]
  selectBucket?: (bucket: string) => void
  delayHashing?: boolean
  disableStateDisplay?: boolean
  ui?: {
    reset?: React.ReactNode
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
  bucket,
  buckets,
  selectBucket,
  delayHashing = false,
  disableStateDisplay = false,
  ui = {},
}: FilesInputProps) {
  const classes = useFilesInputStyles()

  const pRef = React.useRef<Promise<any>>()
  const scheduleUpdate = (waitFor: Promise<any>[]) => {
    const p = waitFor.length ? Promise.all(waitFor) : undefined
    pRef.current = p
    if (p) {
      p.then(() => {
        if (p === pRef.current) {
          const v = ref.current!.value
          onChange({ ...v, counter: (v.counter || 0) + 1 }) // trigger field validation
        }
      })
    }
  }

  const submitting = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const refProps = {
    value,
    disabled: disabled || submitting,
    initial: meta.initial,
    onChange,
    onFilesAction,
    scheduleUpdate,
  }
  const ref = React.useRef<typeof refProps>()
  ref.current = refProps
  const { current: dispatch } = React.useRef((action: FilesAction) => {
    const cur = ref.current!
    if (cur.disabled) return

    const newValue = handleFilesAction(action, { initial: cur.initial })(cur.value)
    // XXX: maybe observe value and trigger this when it changes,
    // regardless of the source of change (e.g. new value supplied directly via the prop)
    const waitFor = Object.values(newValue.added).reduce(
      (acc, f) =>
        S3FilePicker.isS3File(f) || f.hash.ready
          ? acc
          : acc.concat(f.hash.promise.catch(() => {})),
      [] as Promise<any>[],
    )
    cur.scheduleUpdate(waitFor)

    cur.onChange(newValue)
    if (cur.onFilesAction) cur.onFilesAction(action, cur.value, newValue)
  })

  const onDrop = React.useCallback(
    (files) => {
      dispatch(FilesAction.Add({ files: files.map(computeHash) }))
    },
    [dispatch],
  )

  const resetFiles = React.useCallback(() => {
    dispatch(FilesAction.Reset())
  }, [dispatch])

  const isDragging = useDragging()
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    disabled,
    onDrop,
  })

  const computedEntries = useMemoEq(value, computeEntries)

  const stats = useMemoEq(value, ({ added, existing }) => ({
    upload: Object.entries(added).reduce(
      (acc, [path, f]) => {
        if (S3FilePicker.isS3File(f)) return acc // dont count s3 files
        const e = existing[path]
        if (e && (!f.hash.ready || f.hash.value === e.hash)) return acc
        return R.evolve({ count: R.inc, size: R.add(f.size) }, acc)
      },
      { count: 0, size: 0 },
    ),
    s3: Object.entries(added).reduce(
      (acc, [, f]) =>
        S3FilePicker.isS3File(f)
          ? R.evolve({ count: R.inc, size: R.add(f.size) }, acc)
          : acc,
      { count: 0, size: 0 },
    ),
    hashing: Object.values(added).reduce(
      (acc, f) => acc || (!S3FilePicker.isS3File(f) && !f.hash.ready),
      false,
    ),
  }))

  const warn = {
    upload: stats.upload.size > PD.MAX_UPLOAD_SIZE,
    s3: stats.s3.size > PD.MAX_S3_SIZE,
    count: stats.upload.count + stats.s3.count > PD.MAX_FILE_COUNT,
  }

  const [s3FilePickerOpen, setS3FilePickerOpen] = React.useState(false)

  const closeS3FilePicker = React.useCallback(
    (reason: S3FilePicker.CloseReason) => {
      if (!!reason && typeof reason === 'object') {
        dispatch(FilesAction.AddFromS3({ files: reason.files, basePrefix: reason.path }))
      }
      setS3FilePickerOpen(false)
    },
    [dispatch, setS3FilePickerOpen],
  )

  const handleS3Btn = React.useCallback(() => {
    setS3FilePickerOpen(true)
  }, [])

  const isS3FilePickerEnabled = !!buckets?.length

  return (
    <Root className={className}>
      {isS3FilePickerEnabled && (
        <S3FilePicker.Dialog
          bucket={bucket}
          buckets={buckets}
          selectBucket={selectBucket}
          open={s3FilePickerOpen}
          onClose={closeS3FilePicker}
        />
      )}
      <Header>
        <HeaderTitle
          state={
            submitting || disabled // eslint-disable-line no-nested-ternary
              ? 'disabled'
              : error // eslint-disable-line no-nested-ternary
              ? 'error'
              : warn.upload || warn.s3 || warn.count
              ? 'warn'
              : undefined
          }
        >
          {title}
          {(!!stats.upload.count || !!stats.s3.count) && (
            <M.Box
              ml={1}
              color={warn.upload || warn.s3 ? 'warning.dark' : 'text.secondary'}
              component="span"
            >
              (
              {!!stats.upload.count && (
                <M.Box
                  color={warn.upload ? 'warning.dark' : 'text.secondary'}
                  component="span"
                >
                  {readableBytes(stats.upload.size)} to upload
                </M.Box>
              )}
              {!!stats.upload.count && !!stats.s3.count && (
                <M.Box
                  color={!warn.upload || !warn.s3 ? 'text.secondary' : undefined}
                  component="span"
                >
                  {', '}
                </M.Box>
              )}
              {!!stats.s3.count && (
                <M.Box
                  color={warn.s3 ? 'warning.dark' : 'text.secondary'}
                  component="span"
                >
                  {readableBytes(stats.s3.size)} from S3
                </M.Box>
              )}
              )
            </M.Box>
          )}
          {(warn.upload || warn.s3 || warn.count) && (
            <M.Icon style={{ marginLeft: 6 }} fontSize="small">
              error_outline
            </M.Icon>
          )}
          {!delayHashing && stats.hashing && (
            <M.CircularProgress
              className={classes.hashing}
              size={16}
              title="Hashing files"
            />
          )}
        </HeaderTitle>
        <M.Box flexGrow={1} />
        {meta.dirty && (
          <M.Button
            onClick={resetFiles}
            disabled={ref.current.disabled}
            size="small"
            endIcon={<M.Icon fontSize="small">undo</M.Icon>}
          >
            {ui.reset || 'Clear files'}
          </M.Button>
        )}
      </Header>

      <ContentsContainer outlined={isDragging && !ref.current.disabled}>
        <Contents
          {...getRootProps()}
          interactive
          active={isDragActive && !ref.current.disabled}
          error={!!error}
          warn={warn.upload || warn.s3 || warn.count}
        >
          <input {...getInputProps()} />

          {!!computedEntries.length && (
            <FilesContainer error={!!error} warn={warn.upload || warn.s3 || warn.count}>
              {computedEntries.map(
                FilesEntry.match({
                  Dir: (ps) => (
                    <DirUpload
                      {...ps}
                      key={`dir:${ps.name}`}
                      dispatch={dispatch}
                      delayHashing={delayHashing}
                      disableStateDisplay={disableStateDisplay}
                    />
                  ),
                  File: (ps) => (
                    <FileUpload
                      {...ps}
                      key={`file:${ps.name}`}
                      dispatch={dispatch}
                      disableStateDisplay={disableStateDisplay}
                    />
                  ),
                }),
              )}
            </FilesContainer>
          )}

          <DropzoneMessage error={error && (errors[error] || error)} warn={warn} />
        </Contents>
        {submitting && <Lock progress={totalProgress} />}
      </ContentsContainer>
      <div className={classes.actions}>
        <M.Button
          onClick={open}
          disabled={submitting || disabled}
          className={classes.action}
          variant="outlined"
          size="small"
        >
          Add local files
        </M.Button>
        {isS3FilePickerEnabled ? (
          <M.Button
            onClick={handleS3Btn}
            disabled={submitting || disabled}
            className={classes.action}
            variant="outlined"
            size="small"
          >
            Add files from bucket
          </M.Button>
        ) : (
          <Lab.Alert className={classes.warning} severity="info">
            <StyledLink href={DOCS_URL_SOURCE_BUCKETS} target="_blank">
              Learn how to add files from a bucket
            </StyledLink>
          </Lab.Alert>
        )}
      </div>
    </Root>
  )
}

const useFilesSelectorStyles = M.makeStyles((t) => ({
  checkbox: {
    color: `${t.palette.action.active} !important`,
    padding: 3,
    '&:hover': {
      backgroundColor: `${fade(
        t.palette.action.active,
        t.palette.action.hoverOpacity,
      )} !important`,
    },
    '& svg': {
      fontSize: '18px',
    },
  },
}))

interface FilesSelectorEntry {
  type: 'dir' | 'file'
  name: string
  selected: boolean
  size?: number
  meta?: Types.JsonRecord
}

export type FilesSelectorState = FilesSelectorEntry[]

interface FilesSelectorProps {
  input: {
    value: FilesSelectorState
    onChange: (value: FilesSelectorState) => void
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
    initial: FilesSelectorState
  }
  title: React.ReactNode
  truncated?: boolean
}

export function FilesSelector({
  input: { value, onChange },
  className,
  disabled = false,
  errors = {},
  meta,
  title,
  truncated = false,
}: FilesSelectorProps) {
  const classes = useFilesSelectorStyles()

  const submitting = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const selected = React.useMemo(
    () => value.reduce((m, i) => (i.selected ? m + 1 : m), 0),
    [value],
  )

  const toggleAll = React.useCallback(() => {
    onChange(value.map(R.assoc('selected', selected < value.length)))
  }, [onChange, value, selected])

  const handleItemClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      const idx = value.findIndex(R.propEq('name', e.currentTarget.dataset.name!))
      if (idx < 0) return
      onChange(R.adjust(idx, R.evolve({ selected: R.not }), value))
    },
    [onChange, value],
  )

  return (
    <Root className={className}>
      <Header>
        <HeaderTitle
          state={
            submitting || disabled // eslint-disable-line no-nested-ternary
              ? 'disabled'
              : error // eslint-disable-line no-nested-ternary
              ? 'error'
              : truncated
              ? 'warn'
              : undefined
          }
        >
          {title}
          {truncated && (
            // TODO: adjust copy
            <M.Tooltip title="Only the first 1000 items are shown, but the folder contains more">
              <M.Icon style={{ marginLeft: 6 }} fontSize="small">
                error_outline
              </M.Icon>
            </M.Tooltip>
          )}
        </HeaderTitle>
        <M.Box flexGrow={1} />
        {value.length > 0 && (
          <M.Button
            onClick={toggleAll}
            disabled={disabled || submitting}
            size="small"
            endIcon={
              <M.Icon fontSize="small">
                {selected === value.length // eslint-disable-line no-nested-ternary
                  ? 'check_box'
                  : !selected
                  ? 'check_box_outline_blank'
                  : 'indeterminate_check_box_icon'}
              </M.Icon>
            }
          >
            Select {selected < value.length ? 'all' : 'none'}
          </M.Button>
        )}
      </Header>

      <ContentsContainer>
        <Contents error={!!error} warn={truncated}>
          {value.length ? (
            <FilesContainer noBorder>
              {value.map(({ type, name, selected: sel, size }) =>
                type === 'dir' ? (
                  <Dir
                    key={`dir:${name}`}
                    name={name}
                    action={<M.Checkbox className={classes.checkbox} checked={sel} />}
                    onClick={handleItemClick}
                    data-name={name}
                    faint={!sel}
                  />
                ) : (
                  <File
                    key={`file:${name}`}
                    name={name}
                    size={size}
                    action={<M.Checkbox className={classes.checkbox} checked={sel} />}
                    onClick={handleItemClick}
                    data-name={name}
                    faint={!sel}
                    interactive
                  />
                ),
              )}
            </FilesContainer>
          ) : (
            // TODO: adjust copy
            <M.Box
              display="flex"
              flexGrow={1}
              alignItems="center"
              justifyContent="center"
            >
              <M.Typography align="center" color={error ? 'error' : undefined}>
                Current directory is empty
              </M.Typography>
            </M.Box>
          )}
          {submitting && <Lock progress={PROGRESS_EMPTY} />}
        </Contents>
      </ContentsContainer>

      {!!error && (
        <M.FormHelperText error margin="dense">
          {errors[error] || error}
        </M.FormHelperText>
      )}
    </Root>
  )
}
