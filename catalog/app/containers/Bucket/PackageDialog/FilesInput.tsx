import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import {
  ErrorOutline as IconErrorOutline,
  Undo as IconUndo,
  CreateNewFolder as IconCreateNewFolder,
} from '@material-ui/icons'

import * as Dialog from 'components/Dialog'
import { MissingSourceBucket } from 'components/FileEditor/HelpLinks'
import type * as Model from 'model'
import * as BucketPreferences from 'utils/BucketPreferences'
import assertNever from 'utils/assertNever'
import computeFileChecksum from 'utils/checksums'
import useDragging from 'utils/dragging'
import { readableBytes } from 'utils/string'
import * as tagged from 'utils/taggedV2'
import useMemoEq from 'utils/useMemoEq'

import * as Selection from '../Selection'

import EditFileMeta from './EditFileMeta'
import {
  FilesEntryState,
  FilesEntry,
  FilesEntryDir,
  FilesEntryType,
  FilesAction,
  FileWithHash,
  FilesState,
  handleFilesAction,
  EMPTY_DIR_MARKER,
} from './FilesState'
import * as PD from './PackageDialog'
import * as S3FilePicker from './S3FilePicker'
import { calcStats, Stats, StatsWarning } from './filesStats'

export { EMPTY_DIR_MARKER, FilesAction } from './FilesState'
export type { LocalFile, FilesState } from './FilesState'

interface Progress {
  total: number
  loaded: number
  percent: number
}

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    height: 24,
    alignItems: 'center',
  },
  title: {
    ...t.typography.body1,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    flexGrow: 1,
    color: t.palette.text.primary,
  },
  disabled: {
    color: t.palette.text.secondary,
  },
  error: {
    color: t.palette.error.main,
  },
  warn: {
    color: t.palette.warning.dark,
  },
  stats: {
    marginLeft: t.spacing(1),
    fontSize: 'inherit',
    color: t.palette.text.secondary,
  },
  uploadStats: {
    fontSize: 'inherit',
  },
  s3Stats: {
    fontSize: 'inherit',
  },
  separator: {
    fontSize: 'inherit',
  },
  warningIcon: {
    marginLeft: 6,
    fontSize: 'small',
  },
  hashing: {
    marginLeft: t.spacing(1),
  },
  buttons: {
    display: 'flex',
    marginLeft: 'auto',
    alignItems: 'flex-start',
  },
  btnDivider: {
    margin: t.spacing(0, 1),
  },
}))

interface HeaderProps {
  delayHashing: boolean
  dirty: boolean
  disabled: boolean
  error: boolean
  onAddFolder: (name: string) => void
  onReset: () => void
  resetTitle: React.ReactNode
  title: React.ReactNode
  stats: Stats
}

function Header({
  delayHashing,
  dirty,
  disabled,
  error,
  onAddFolder,
  onReset,
  resetTitle,
  title,
  stats,
}: HeaderProps) {
  const classes = useHeaderStyles()

  const hasStats = stats.upload.count > 0 || stats.s3.count > 0

  const promptOpts = React.useMemo(
    () => ({
      onSubmit: (name: string) => onAddFolder(name),
      title: 'Enter new directory path',
      validate: (p: string) => (!p ? new Error("Path can't be empty") : undefined),
    }),
    [onAddFolder],
  )
  const prompt = Dialog.usePrompt(promptOpts)

  return (
    <div className={classes.root}>
      <div
        className={cx(classes.title, {
          [classes.disabled]: disabled,
          [classes.error]: error,
          [classes.warn]: !!stats.warn,
        })}
      >
        {title}

        {hasStats && (
          <span className={cx(classes.stats, { [classes.warn]: !!stats.warn })}>
            (
            <span className={classes.uploadStats}>
              {stats.upload.count > 0 && (
                <>{readableBytes(stats.upload.size)} to upload</>
              )}
            </span>
            {stats.upload.count > 0 && stats.s3.count > 0 && (
              <span className={classes.separator}>, </span>
            )}
            <span className={classes.s3Stats}>
              {stats.s3.count > 0 && <>{readableBytes(stats.s3.size)} from S3</>}
            </span>
            )
          </span>
        )}

        {stats.warn && (
          <IconErrorOutline className={classes.warningIcon} fontSize="inherit" />
        )}

        {!delayHashing && stats.hashing && (
          <M.CircularProgress
            className={classes.hashing}
            size={16}
            title="Hashing files"
          />
        )}
      </div>

      <div className={classes.buttons}>
        {dirty && (
          <>
            <M.Button
              onClick={onReset}
              disabled={disabled}
              size="small"
              endIcon={<IconUndo fontSize="small" />}
            >
              {resetTitle}
            </M.Button>
            <M.Divider className={classes.btnDivider} orientation="vertical" flexItem />
          </>
        )}

        <M.IconButton
          disabled={disabled}
          onClick={prompt.open}
          size="small"
          title="Add empty folder"
        >
          <IconCreateNewFolder fontSize="small" />
        </M.IconButton>
      </div>

      {/* Render prompt dialog */}
      {prompt.render(
        <M.Typography variant="body2">
          You can add new directories and drag-and-drop files and folders into them.
          Please note that directories that remain empty will be excluded during the
          package creation process.
        </M.Typography>,
      )}
    </div>
  )
}

interface S3FilesButtonProps {
  className?: string
  disabled?: boolean
  onSubmit: (filesMap: Record<string, Model.S3File>) => void
  sourceBuckets: BucketPreferences.SourceBuckets
}

export default function S3FilesButton({
  className,
  disabled = false,
  onSubmit,
  sourceBuckets,
}: S3FilesButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedBucket, selectBucket] = React.useState(sourceBuckets.getDefault)

  const handleClose = React.useCallback(
    (reason: S3FilePicker.CloseReason) => {
      if (reason && typeof reason === 'object') {
        onSubmit(reason.filesMap)
      }
      setOpen(false)
    },
    [onSubmit],
  )

  const handleS3Btn = React.useCallback(() => setOpen(true), [])

  if (!sourceBuckets.list.length) {
    return (
      <MissingSourceBucket>
        <M.Button disabled className={className} variant="outlined" size="small">
          Add files from bucket
        </M.Button>
      </MissingSourceBucket>
    )
  }

  return (
    <>
      <Selection.Provider>
        <S3FilePicker.Dialog
          bucket={selectedBucket}
          buckets={sourceBuckets.list}
          selectBucket={selectBucket}
          open={open}
          onClose={handleClose}
        />
      </Selection.Provider>

      <M.Button
        onClick={handleS3Btn}
        disabled={disabled}
        className={className}
        variant="outlined"
        size="small"
      >
        Add files from bucket
      </M.Button>
    </>
  )
}

const COLORS = {
  default: M.colors.grey[900],
  added: M.colors.green[900],
  modified: M.darken(M.colors.yellow[900], 0.2),
  deleted: M.colors.red[900],
  invalid: M.colors.red[400],
}

const hasHash = (f: File): f is FileWithHash => !!f && !!(f as FileWithHash).hash

const isDragReady = (state: FilesEntryState) => {
  switch (state) {
    case 'added':
    case 'unchanged':
      return true
    default:
      return false
  }
}

const isDropReady = (state: FilesEntryState) => {
  switch (state) {
    case 'added':
    case 'modified':
    case 'unchanged':
      return true
    default:
      return false
  }
}

const isFileDropReady = (entry: FilesEntry) =>
  FilesEntry.match({
    Dir: (d) => isDropReady(d.state),
    File: (f) => isDropReady(f.state),
  })(entry)

export function computeHash(f: File) {
  if (hasHash(f)) return f
  const hashP = computeFileChecksum(f)
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
    .then((checksum) => {
      fh.hash.value = checksum
      fh.hash.ready = true
      return checksum
    })
  return fh
}

interface DispatchFilesAction {
  (action: FilesAction): void
}

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
    // If file is "hidden",
    // and it is the actual file, not a parent path;
    // then we skip inserting it into UI
    const hiddenFileBase =
      FilesEntry.match(
        {
          File: (f) => f.type === 'hidden',
          Dir: () => false,
        },
        file,
      ) && !rest.length
    inserted = hiddenFileBase ? baseDir : insertIntoDir(rest, file, baseDir)
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
  meta?: Model.EntryMeta
}

function matchErrorToEntry(path: string, errors: PD.EntriesValidationErrors | null) {
  return errors?.find((e) => PD.isEntryError(e) && e.data.logical_key === path)
}

const computeEntries = ({
  value: { added, deleted, existing },
  errors,
}: {
  value: FilesState
  errors: PD.EntriesValidationErrors | null
}) => {
  const existingEntries: IntermediateEntry[] = Object.entries(existing).map(
    ([path, { size, hash, meta }]) => {
      if (path in deleted) {
        return { state: 'deleted' as const, type: 'local' as const, path, size, meta }
      }
      if (matchErrorToEntry(path, errors)) {
        return { state: 'invalid' as const, type: 'local' as const, path, size, meta }
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
            : R.equals(a.hash.value, hash)
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
    if (matchErrorToEntry(path, errors)) {
      return acc.concat({
        state: 'invalid' as const,
        type: 'local' as const,
        path,
        size: f.size,
        meta: f.meta,
      })
    }
    const type =
      // eslint-disable-next-line no-nested-ternary
      f === EMPTY_DIR_MARKER
        ? ('hidden' as const)
        : S3FilePicker.isS3File(f)
          ? ('s3' as const)
          : ('local' as const)
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

const useEntryIconStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  draggable: {
    cursor: 'move',
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
    '$invalid &': {
      borderColor: COLORS.invalid,
    },
  },
  state: {
    fontFamily: t.typography.fontFamily,
    fontWeight: t.typography.fontWeightBold,
    fontSize: 9,
    color: t.palette.background.paper,
    '$invalid &': {
      color: COLORS.invalid,
    },
  },
  hashProgress: {
    color: t.palette.background.paper,
  },
  invalid: {},
}))

type EntryIconProps = React.PropsWithChildren<{
  state: FilesEntryState
  overlay?: React.ReactNode
  setDragRef?: (el: HTMLDivElement) => void
}>

function EntryIcon({ setDragRef, state, overlay, children }: EntryIconProps) {
  const classes = useEntryIconStyles()
  const stateContents = {
    added: '+',
    invalid: '!',
    deleted: <>&ndash;</>,
    modified: '~',
    hashing: 'hashing',
    unchanged: undefined,
  }[state]
  return (
    <div
      className={cx(classes.root, {
        [classes.draggable]: !!setDragRef,
        [classes.invalid]: state === 'invalid',
      })}
      draggable={!!setDragRef}
      ref={setDragRef}
    >
      <M.Icon className={cx(classes.icon)}>{children}</M.Icon>
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
  invalid: {},
  actions: {
    flexShrink: 0,
    '$invalid &': {
      color: t.palette.primary.contrastText,
    },
  },
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
    '&$invalid': {
      background: COLORS.invalid,
      color: t.palette.primary.contrastText,
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
  setDragRef?: (el: HTMLDivElement) => void
  name: string
  state?: FilesEntryState
  type?: FilesEntryType
  size?: number
  action?: React.ReactNode
  meta?: Model.EntryMeta
  metaDisabled?: boolean
  onMeta?: (value?: Model.EntryMeta) => void
  interactive?: boolean
  faint?: boolean
  disableStateDisplay?: boolean
}

function File({
  setDragRef,
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
  const stateDisplay = disableStateDisplay && state !== 'invalid' ? 'unchanged' : state

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
        <EntryIcon
          overlay={type === 's3' ? 'S3' : undefined}
          setDragRef={isDragReady(state) ? setDragRef : undefined}
          state={stateDisplay}
        >
          insert_drive_file
        </EntryIcon>
        <div className={classes.name} title={name}>
          {name}
        </div>
        {size != null && <div className={classes.size}>{readableBytes(size)}</div>}
      </div>
      <div className={classes.actions}>
        {onMeta && (
          <EditFileMeta
            disabled={metaDisabled}
            key={metaKey}
            name={name}
            onChange={onMeta}
            state={stateDisplay}
            value={meta}
          />
        )}
        {action}
      </div>
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
  invalid: {},
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
    '$active > &': {
      outline: `2px dashed ${t.palette.primary.light}`,
      outlineOffset: '-2px',
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
    '$invalid > &': {
      background: COLORS.invalid,
      color: t.palette.primary.contrastText,
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
  setDragRef?: (el: HTMLDivElement) => void
  setDropRef?: (el: HTMLDivElement) => void
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
    setDragRef,
    setDropRef,
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
  // on drag (and drop) head only

  return (
    <div
      className={cx(className, classes.root, classes[stateDisplay], {
        [classes.active]: active,
      })}
      ref={ref}
      {...props}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div
        onClick={onHeadClick}
        className={classes.head}
        role="button"
        tabIndex={0}
        ref={setDropRef}
      >
        <div className={cx(classes.headInner, faint && classes.faint)}>
          <EntryIcon
            setDragRef={isDragReady(state) ? setDragRef : undefined}
            state={stateDisplay}
          >
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
  warn: StatsWarning | null
}

function DropzoneMessage({ label: defaultLabel, error, warn }: DropzoneMessageProps) {
  const classes = useDropzoneMessageStyles()

  const label = React.useMemo(() => {
    if (error) return <span>{error}</span>
    if (!warn) {
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
  }, [defaultLabel, error, warn])

  return (
    <div
      className={cx(classes.root, {
        [classes.error]: error,
        [classes.warning]: !error && !!warn,
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

function Root({ className, ...props }: React.PropsWithChildren<{ className?: string }>) {
  const classes = useRootStyles()
  return (
    <DndProvider>
      <div className={cx(classes.root, className)} {...props} />
    </DndProvider>
  )
}

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

function Lock({ progress }: { progress?: Progress }) {
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
}>

function FilesContainer({ error, warn, children }: FilesContainerProps) {
  const classes = useFilesContainerStyles()
  return (
    <div
      className={cx(classes.root, error && classes.err, !error && warn && classes.warn)}
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
  noMeta: boolean
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
  noMeta,
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
      case 'invalid':
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
    (m?: Model.EntryMeta) => dispatch(FilesAction.Meta({ path, meta: m })),
    [dispatch, path],
  )

  const file = React.useMemo(
    () => FilesEntry.File({ name, state, type, size, meta }),
    [name, state, type, size, meta],
  )
  const { onDrag } = useDnd()
  const [dragRef, setDragRef] = React.useState<HTMLDivElement | null>(null)
  // Note We don't have a sort order. We can move INTO dir only
  React.useEffect(() => {
    if (!dragRef) return
    return onDrag(dragRef, [file, prefix])
  }, [onDrag, file, prefix, dragRef])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <File
      setDragRef={setDragRef}
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
      onMeta={noMeta ? undefined : onMeta}
      action={
        <M.IconButton
          color="inherit"
          onClick={action.handler}
          size="small"
          title={action.hint}
        >
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
  noMeta: boolean
}

function DirUpload({
  name,
  state,
  childEntries,
  prefix,
  dispatch,
  delayHashing,
  disableStateDisplay,
  noMeta,
}: DirUploadProps) {
  const [expanded, setExpanded] = React.useState(!childEntries.length)

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
    (files: File[]) => {
      dispatch(FilesAction.Add({ prefix: path, files: files.map(computeHash) }))
    },
    [dispatch, path],
  )

  const dir = React.useMemo(
    () => FilesEntry.Dir({ name, state, childEntries }),
    [name, state, childEntries],
  )
  const { draggingOver, onDrag, onDragover, onDrop: onDragMove } = useDnd()

  const [dragRef, setDragRef] = React.useState<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!dragRef) return
    return onDrag(dragRef, [dir, prefix])
  }, [dir, onDrag, prefix, dragRef])

  const [dropRef, setDropRef] = React.useState<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!dropRef) return
    return onDragover(dropRef, dir)
  }, [onDragover, dir, dropRef])
  React.useEffect(() => {
    if (!dropRef) return
    return onDragMove(dropRef, (source) => {
      dispatch(FilesAction.Move({ source, dest: [dir, prefix] }))
    })
  }, [dir, dispatch, onDragMove, prefix, dropRef])

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
      case 'invalid':
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
      active={isDragActive || draggingOver === dir}
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
      setDragRef={setDragRef}
      setDropRef={setDropRef}
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
                noMeta={noMeta}
              />
            ),
            File: (ps) => (
              <FileUpload
                {...ps}
                key={ps.name}
                prefix={path}
                dispatch={dispatch}
                disableStateDisplay={disableStateDisplay}
                noMeta={noMeta}
              />
            ),
          }),
        )}
    </Dir>
  )
}

type Unsubscribe = () => void

type Prefix = string | undefined
interface Dnd {
  dragging: [FilesEntry, Prefix] | null // what file/dir we are dragging
  draggingOver: FilesEntry | null // above what file/dir we are dragging
  onDrag: (el: HTMLDivElement, f: [FilesEntry, Prefix]) => Unsubscribe | void
  onDragover: (el: HTMLDivElement, f: FilesEntry) => Unsubscribe | void
  onDrop: (
    el: HTMLDivElement,
    callback: (f: [FilesEntry, Prefix]) => void,
  ) => Unsubscribe | void
}

const noop: Unsubscribe = () => {}

const DndContext = React.createContext<Dnd>({
  dragging: null,
  draggingOver: null,
  onDrag: () => noop,
  onDragover: () => noop,
  onDrop: () => noop,
})

interface DndProviderProps {
  children: React.ReactNode
}

const useDnd = () => React.useContext(DndContext)

function DndProvider({ children }: DndProviderProps) {
  const [dragging, setDragging] = React.useState<[FilesEntry, Prefix] | null>(null)
  const onDrag = React.useCallback((el: HTMLDivElement, f: [FilesEntry, Prefix]) => {
    if (!el) return
    const start = () => setDragging(f)
    const end = () => setDragging(null)
    el.addEventListener('dragstart', start)
    el.addEventListener('dragend', end)
    return () => {
      el.removeEventListener('dragstart', start)
      el.removeEventListener('dragend', end)
    }
  }, [])

  const [draggingOver, setDraggingOver] = React.useState<FilesEntry | null>(null)
  const onDragover = React.useCallback((el: HTMLDivElement, f: FilesEntry) => {
    if (!el || !isFileDropReady(f)) return
    let timerId: ReturnType<typeof setTimeout> | null = null
    const enter = (e: Event) => {
      e.preventDefault()
      setDraggingOver(f)
      // Workaround to hide draging over effect when dragleave wasn't triggered
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => setDraggingOver(null), 5000)
    }
    const leave = (e: Event) => {
      if (e.target !== el) return
      e.preventDefault()
      setDraggingOver(null)
    }

    el.addEventListener('dragenter', enter)
    el.addEventListener('dragleave', leave)
    return () => {
      if (timerId) clearTimeout(timerId)
      el.removeEventListener('dragenter', enter)
      el.removeEventListener('dragleave', leave)
    }
  }, [])

  const onDrop = React.useCallback(
    (el: HTMLDivElement, callback: (f: [FilesEntry, Prefix]) => void) => {
      const cb = () => {
        if (dragging) {
          if (isFileDropReady(dragging[0])) {
            callback(dragging)
          }
          setDragging(null)
        }
      }
      el.addEventListener('drop', cb)
      return () => el.removeEventListener('drop', cb)
    },
    [dragging],
  )

  return (
    <DndContext.Provider value={{ dragging, draggingOver, onDrag, onDragover, onDrop }}>
      {children}
    </DndContext.Provider>
  )
}

const useFilesInputStyles = M.makeStyles((t) => ({
  hashing: {
    marginLeft: t.spacing(1),
  },
  actions: {
    alignItems: 'flex-start',
    display: 'flex',
    marginTop: t.spacing(1),
    gap: t.spacing(1),
  },
  action: {
    flexGrow: 1,
    flexShrink: 0,
  },
  iconAction: {
    marginRight: t.spacing(1),
    minWidth: t.spacing(6),
  },
  buttons: {
    display: 'flex',
    marginLeft: 'auto',
    alignItems: 'flex-start',
  },
  btnDivider: {
    margin: t.spacing(0, 1),
  },
  warning: {
    display: 'flex',
    flexBasis: `calc(50% - ${t.spacing(2)}px)`,
    marginLeft: t.spacing(2),
  },
  warningItem: {
    ...t.typography.caption,
  },
}))

interface FilesInputProps {
  input: {
    value: FilesState
    onChange: (value: FilesState) => void
  }
  className?: string
  errors?: Record<string, React.ReactNode>
  meta: RF.FieldMetaState<FilesState> & { initial: FilesState }
  onFilesAction?: (
    action: FilesAction,
    oldValue: FilesState,
    newValue: FilesState,
  ) => void
  title: React.ReactNode
  totalProgress: Progress
  sourceBuckets?: BucketPreferences.SourceBuckets
  delayHashing?: boolean
  disableStateDisplay?: boolean
  ui?: {
    reset?: React.ReactNode
  }
  validationErrors: PD.EntriesValidationErrors | null
  noMeta?: boolean
}

export function FilesInput({
  input: { value, onChange },
  className,
  errors = {},
  meta,
  onFilesAction,
  title,
  totalProgress,
  sourceBuckets,
  delayHashing = false,
  disableStateDisplay = false,
  ui = {},
  validationErrors,
  noMeta = false, // FIXME: handle S3 meta upload, `s3.upload` supports that
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

  const disabled = meta.submitting || meta.submitSucceeded || meta.validating
  const error =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))

  const refProps = {
    value,
    disabled,
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
    (files) => dispatch(FilesAction.Add({ files: files.map(computeHash) })),
    [dispatch],
  )
  const onReset = React.useCallback(() => dispatch(FilesAction.Reset()), [dispatch])
  const onAddFolder = React.useCallback(
    (name: string) => dispatch(FilesAction.AddFolder(name)),
    [dispatch],
  )
  const onS3FilePicker = React.useCallback(
    (filesMap: Record<string, Model.S3File>) => dispatch(FilesAction.AddFromS3(filesMap)),
    [dispatch],
  )

  const isDragging = useDragging()
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    disabled,
    onDrop,
  })

  const valueWithErrors = React.useMemo(
    () => ({ errors: validationErrors, value }),
    [validationErrors, value],
  )
  const computedEntries = useMemoEq(valueWithErrors, computeEntries)

  const stats = React.useMemo(() => calcStats(value), [value])

  return (
    <Root className={className}>
      <Header
        delayHashing={delayHashing}
        dirty={!!meta.dirty}
        disabled={!!disabled}
        error={error}
        onAddFolder={onAddFolder}
        onReset={onReset}
        resetTitle={ui.reset || 'Clear files'}
        stats={stats}
        title={title}
      />

      <ContentsContainer outlined={isDragging && !ref.current.disabled}>
        <Contents
          {...getRootProps()}
          interactive
          active={isDragActive && !ref.current.disabled}
          error={!!error}
          warn={!!stats.warn}
        >
          <input {...getInputProps()} />

          {!!computedEntries.length && (
            <FilesContainer error={!!error} warn={!!stats.warn}>
              {computedEntries.map(
                FilesEntry.match({
                  Dir: (ps) => (
                    <DirUpload
                      {...ps}
                      key={`dir:${ps.name}`}
                      dispatch={dispatch}
                      delayHashing={delayHashing}
                      disableStateDisplay={disableStateDisplay}
                      noMeta={noMeta}
                    />
                  ),
                  File: (ps) => (
                    <FileUpload
                      {...ps}
                      key={`file:${ps.name}`}
                      dispatch={dispatch}
                      disableStateDisplay={disableStateDisplay}
                      noMeta={noMeta}
                    />
                  ),
                }),
              )}
            </FilesContainer>
          )}

          <DropzoneMessage error={error && (errors[error] || error)} warn={stats.warn} />
        </Contents>
        {disabled && <Lock progress={totalProgress} />}
      </ContentsContainer>
      <div className={classes.actions}>
        <M.Button
          onClick={open}
          disabled={disabled}
          className={classes.action}
          variant="outlined"
          size="small"
        >
          Add local files
        </M.Button>
        {sourceBuckets && (
          <S3FilesButton
            onSubmit={onS3FilePicker}
            disabled={disabled}
            className={classes.action}
            sourceBuckets={sourceBuckets}
          />
        )}
      </div>
    </Root>
  )
}
