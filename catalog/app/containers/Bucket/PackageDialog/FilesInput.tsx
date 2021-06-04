import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone, FileWithPath } from 'react-dropzone'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import { fade } from '@material-ui/core/styles'

import * as urls from 'constants/urls'
import StyledLink from 'utils/StyledLink'
import useDragging from 'utils/dragging'
import { withoutPrefix } from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import * as tagged from 'utils/taggedV2'
import useMemoEq from 'utils/useMemoEq'

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
    value: string | undefined
    ready: boolean
    promise: Promise<string>
  }
}

const hasHash = (f: File): f is FileWithHash => !!f && !!(f as FileWithHash).hash

// XXX: it might make sense to limit concurrency, tho the tests show that perf os ok, since hashing is async anyways
function computeHash<F extends File>(f: F) {
  if (hasHash(f)) return f
  const promise = PD.hashFile(f)
  const fh = f as F & FileWithHash
  fh.hash = { value: undefined, ready: false, promise }
  promise
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.log('Error hashing file:')
      // eslint-disable-next-line no-console
      console.error(e)
      return undefined
    })
    .then((hash) => {
      fh.hash.value = hash
      fh.hash.ready = true
    })
  return fh
}

function ensureExhaustive(x: never): never {
  throw new Error(`Non-exhaustive match: '${x}'`)
}

export const FilesAction = tagged.create(
  'app/containers/Bucket/PackageDialog/FilesInput:FilesAction' as const,
  {
    Add: (v: { files: FileWithPath[]; prefix?: string }) => ({
      ...v,
      files: v.files.map(computeHash),
    }),
    AddFromS3: (v: {
      files: S3FilePicker.S3File[]
      basePrefix: string
      prefix?: string
    }) => v,
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
}

export type LocalFile = FileWithPath & FileWithHash

export interface FilesState {
  added: Record<string, LocalFile | S3FilePicker.S3File>
  deleted: Record<string, true>
  existing: Record<string, ExistingFile>
  // XXX: workaround used to re-trigger validation and dependent computations
  // required due to direct mutations of File objects
  counter?: number
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
      const path = (prefix || '') + PD.getNormalizedPath(file)
      return R.evolve(
        {
          added: R.assoc(path, file),
          deleted: R.dissoc(path),
        },
        acc,
      ) as FilesState
    }, state),
  AddFromS3: ({ files, basePrefix, prefix }) => (state) =>
    files.reduce((acc, file) => {
      const path = (prefix || '') + withoutPrefix(basePrefix, file.key)
      return R.evolve(
        {
          added: R.assoc(path, file),
          deleted: R.dissoc(path),
        },
        acc,
      ) as FilesState
    }, state),
  Delete: (path) =>
    R.evolve({
      added: R.dissoc(path),
      deleted: R.assoc(path, true),
    }) as FilesStateTransformer,
  // add all descendants from existing to deleted
  DeleteDir: (prefix) => ({ existing, added, deleted, ...rest }) => ({
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
}

const computeEntries = ({ added, deleted, existing }: FilesState) => {
  const existingEntries: IntermediateEntry[] = Object.entries(existing).map(
    ([path, { size, hash }]) => {
      if (path in deleted) {
        return { state: 'deleted' as const, type: 'local' as const, path, size }
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
        return { state, type, path, size: a.size }
      }
      return { state: 'unchanged' as const, type: 'local' as const, path, size }
    },
  )
  const addedEntries = Object.entries(added).reduce((acc, [path, f]) => {
    if (path in existing) return acc
    const type = S3FilePicker.isS3File(f) ? ('s3' as const) : ('local' as const)
    return acc.concat({ state: 'added', type, path, size: f.size })
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
  const stateContents =
    state &&
    {
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
  interactive?: boolean
  faint?: boolean
}

function File({
  name,
  state = 'unchanged',
  type = 'local',
  size,
  action,
  interactive = false,
  faint = false,
  className,
  ...props
}: FileProps) {
  const classes = useFileStyles()

  return (
    <div
      className={cx(
        className,
        classes.root,
        classes[state],
        interactive && classes.interactive,
      )}
      {...props}
    >
      <div className={cx(classes.inner, faint && classes.faint)}>
        <EntryIcon state={state} overlay={type === 's3' ? 'S3' : undefined}>
          insert_drive_file
        </EntryIcon>
        <div className={classes.name} title={name}>
          {name}
        </div>
        {size != null && <div className={classes.size}>{readableBytes(size)}</div>}
      </div>
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
  active?: boolean
  empty?: boolean
  expanded?: boolean
  faint?: boolean
  onChangeExpanded?: (expanded: boolean) => void
  action?: React.ReactNode
  onHeadClick?: React.MouseEventHandler<HTMLDivElement>
}

const Dir = React.forwardRef<HTMLDivElement, DirProps>(function Dir(
  {
    name,
    state = 'unchanged',
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

  return (
    <div
      className={cx(className, classes.root, classes[state], {
        [classes.active]: active,
      })}
      ref={ref}
      {...props}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div onClick={onHeadClick} className={classes.head} role="button" tabIndex={0}>
        <div className={cx(classes.headInner, faint && classes.faint)}>
          <EntryIcon state={state}>{expanded ? 'folder_open' : 'folder'}</EntryIcon>
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
  error: React.ReactNode
  warn: { upload: boolean; s3: boolean }
}

function DropzoneMessage({ error, warn }: DropzoneMessageProps) {
  const classes = useDropzoneMessageStyles()

  const label = React.useMemo(() => {
    if (error) return error
    if (warn.upload || warn.s3)
      return (
        <>
          {warn.upload && (
            <>
              Total size of local files exceeds recommended maximum of{' '}
              {readableBytes(PD.MAX_UPLOAD_SIZE)}.
            </>
          )}
          {warn.upload && warn.s3 && <br />}
          {warn.s3 && (
            <>
              Total size of files from S3 exceeds recommended maximum of{' '}
              {readableBytes(PD.MAX_S3_SIZE)}.
            </>
          )}
        </>
      )
    return 'Drop files here or click to browse'
  }, [error, warn.upload, warn.s3])

  return (
    <div
      className={cx(classes.root, {
        [classes.error]: error,
        [classes.warning]: !error && (warn.upload || warn.s3),
      })}
    >
      <span>{label}</span>
    </div>
  )
}

const useRootStyles = M.makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
})

function Root({ className, ...props }: React.PropsWithChildren<{ className?: string }>) {
  const classes = useRootStyles()
  return <div className={cx(classes.root, className)} {...props} />
}

const useHeaderStyles = M.makeStyles({
  root: {
    display: 'flex',
    height: 24,
  },
})

function Header(props: React.PropsWithChildren<{}>) {
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

function HeaderTitle({
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

function Lock({
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

function FilesContainer({ error, warn, noBorder, children }: FilesContainerProps) {
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

function ContentsContainer({ outlined, className, ...props }: ContentsContainerProps) {
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

const Contents = React.forwardRef<HTMLDivElement, ContentsProps>(function Contents(
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
  dispatch: DispatchFilesAction
}

function FileUpload({ name, state, type, size, prefix, dispatch }: FileUploadProps) {
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
        ensureExhaustive(state)
    }
  }, [state, dispatch, path])

  const onClick = React.useCallback((e: React.MouseEvent) => {
    // stop click from propagating to parent elements and triggering their handlers
    e.stopPropagation()
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <File
      onClick={onClick}
      role="button"
      tabIndex={0}
      state={state}
      type={type}
      name={name}
      size={size}
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
}

function DirUpload({ name, state, childEntries, prefix, dispatch }: DirUploadProps) {
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
      dispatch(FilesAction.Add({ prefix: path, files }))
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
        ensureExhaustive(state)
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
              <DirUpload {...ps} key={ps.name} prefix={path} dispatch={dispatch} />
            ),
            File: (ps) => (
              <FileUpload {...ps} key={ps.name} prefix={path} dispatch={dispatch} />
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
      dispatch(FilesAction.Add({ files }))
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
              : warn.upload || warn.s3
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
          {(warn.upload || warn.s3) && (
            <M.Icon style={{ marginLeft: 6 }} fontSize="small">
              error_outline
            </M.Icon>
          )}
          {stats.hashing && (
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
            Undo changes
          </M.Button>
        )}
      </Header>

      <ContentsContainer outlined={isDragging && !ref.current.disabled}>
        <Contents
          {...getRootProps()}
          interactive
          active={isDragActive && !ref.current.disabled}
          error={!!error}
          warn={warn.upload || warn.s3}
        >
          <input {...getInputProps()} />

          {!!computedEntries.length && (
            <FilesContainer error={!!error} warn={warn.upload || warn.s3}>
              {computedEntries.map(
                FilesEntry.match({
                  Dir: (ps) => (
                    <DirUpload {...ps} key={`dir:${ps.name}`} dispatch={dispatch} />
                  ),
                  File: (ps) => (
                    <FileUpload {...ps} key={`file:${ps.name}`} dispatch={dispatch} />
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
            To add from S3 bucket{' '}
            <StyledLink href={DOCS_URL_SOURCE_BUCKETS} target="_blank">
              see docs
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
