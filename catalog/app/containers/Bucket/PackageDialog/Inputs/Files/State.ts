import { join, basename } from 'path'

import * as R from 'ramda'
import { FileWithPath } from 'react-dropzone'

import type * as Model from 'model'
import computeFileChecksum from 'utils/checksums'
import dissocBy from 'utils/dissocBy'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import * as Types from 'utils/types'

export const HASHING = 'hashing'
export const HASHING_ERROR = 'hashingError'

export const validateHashingComplete = (state: FilesState) => {
  const files = Object.values(state.added).filter((f) => !isS3File(f)) as FileWithHash[]
  if (files.some((f) => f.hash.ready && !f.hash.value)) return HASHING_ERROR
  if (files.some((f) => !f.hash.ready)) return HASHING
  return undefined
}

export const EMPTY_DIR_MARKER = {
  bucket: '[$empty$]',
  key: '[$empty$]',
  size: 0,
}
const EMPTY_DIR_MARKER_PATH = '[$.quiltkeep$]'

// Rename root key in object
// In other words, move value from one key to another
export function renameKey<T = Types.Json>(
  from: string,
  to: string,
  obj: Record<string, T>,
) {
  const { [from]: property, ...rest } = obj
  return {
    ...rest,
    [to]: property,
  }
}

// Moves all `foo/bar/*` keys to `foo/baz/*` as `/foo/baz/bar/*`
export function renameKeys<T = Types.Json>(
  sourcePrefix: string,
  destPath: string,
  obj: Record<string, T>,
) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (!key.startsWith(sourcePrefix)) return { ...acc, [key]: value }
    const newKey = key.replace(
      s3paths.ensureSlash(sourcePrefix),
      s3paths.ensureSlash(join(destPath, basename(sourcePrefix))),
    )
    return { ...acc, [newKey]: value }
  }, {})
}

function packageEntryToS3File(entry: Model.PackageEntry): Model.S3File {
  return {
    ...s3paths.parseS3Url(entry.physicalKey),
    meta: entry.meta,
    size: entry.size,
  }
}

export function moveExistingToAdded(
  sourcePath: string,
  destPath: string,
  state: FilesState,
) {
  const converted = packageEntryToS3File(state.existing[sourcePath])
  const added = R.assoc(destPath, converted, state.added)
  const deleted = R.assoc(sourcePath, true as const, state.deleted)
  return {
    ...state,
    added,
    deleted,
  }
}

export function moveExistingDirectoryToAdded(
  sourcePath: string,
  destPath: string,
  state: FilesState,
) {
  return Object.entries(state.existing).reduce((acc, [key, value]) => {
    if (!key.startsWith(sourcePath)) return acc
    const newKey = key.replace(
      s3paths.ensureSlash(sourcePath),
      s3paths.ensureSlash(join(destPath, basename(sourcePath))),
    )
    const added = R.assoc(newKey, packageEntryToS3File(value), acc.added)
    const deleted = R.assoc(key, true, acc.deleted)
    return { ...acc, added, deleted }
  }, state)
}

export interface FileWithHash extends File {
  hash: {
    ready: boolean
    value?: Model.Checksum
    error?: Error
    promise: Promise<Model.Checksum | undefined>
  }
  meta?: Types.JsonRecord
}

export type LocalFile = FileWithPath & FileWithHash

const hasHash = (f: File): f is FileWithHash => !!f && !!(f as FileWithHash).hash

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

export interface FilesState {
  added: Record<string, LocalFile | Model.S3File>
  deleted: Record<string, true>
  existing: Record<string, Model.PackageEntry>
  // XXX: workaround used to re-trigger validation and dependent computations
  // required due to direct mutations of File objects
  counter?: number
}

export type FilesEntryState =
  | 'deleted'
  | 'modified'
  | 'unchanged'
  | 'hashing'
  | 'added'
  | 'invalid'

export type FilesEntryType = 's3' | 'local' | 'hidden'

const FilesEntryTag = 'app/containers/Bucket/PackageDialog/FilesInput:FilesEntry' as const

export const FilesEntry = tagged.create(FilesEntryTag, {
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
    meta?: Model.EntryMeta
  }) => v,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FilesEntry = tagged.InstanceOf<typeof FilesEntry>
export type FilesEntryDir = ReturnType<typeof FilesEntry.Dir>

export const FilesAction = tagged.create(
  'app/containers/Bucket/PackageDialog/FilesInput:FilesAction' as const,
  {
    Add: (v: { files: FileWithHash[]; prefix?: string }) => v,
    AddFolder: (path: string) => path,
    AddFromS3: (filesMap: Record<string, Model.S3File>) => filesMap,
    Delete: (path: string) => path,
    DeleteDir: (prefix: string) => prefix,
    Meta: (v: { path: string; meta?: Model.EntryMeta }) => v,
    Move: (v: { source?: [FilesEntry, string?]; dest: [FilesEntry, string?] }) => v,
    Revert: (path: string) => path,
    RevertDir: (prefix: string) => prefix,
    Reset: () => {},
  },
)

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FilesAction = tagged.InstanceOf<typeof FilesAction>

const addMetaToFile = (
  file: Model.PackageEntry | LocalFile | Model.S3File,
  meta?: Model.EntryMeta,
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

const getNormalizedPath = (f: { path?: string; name: string }) => {
  const p = f.path || f.name
  return p.startsWith('/') ? p.substring(1) : p
}

function hasDir(dir: string, obj: FilesState['existing'] | FilesState['added']) {
  for (const key in obj) {
    if (key.startsWith(dir)) return true
  }
  return false
}

export const handleFilesAction = FilesAction.match<
  (state: FilesState) => FilesState,
  [{ initial: FilesState }]
>({
  Add:
    ({ files, prefix }) =>
    (state) =>
      files.reduce((acc, file) => {
        const path = (prefix || '') + getNormalizedPath(file)
        return R.evolve(
          {
            added: R.assoc(path, file),
            deleted: R.dissoc(path),
          },
          acc,
        )
      }, state),
  AddFolder: (path) =>
    R.evolve({
      added: R.assoc(join(path, EMPTY_DIR_MARKER_PATH), EMPTY_DIR_MARKER),
      deleted: R.dissoc(path),
    }),
  AddFromS3: (filesMap) =>
    R.evolve({
      added: R.mergeLeft(filesMap),
      deleted: R.omit(Object.keys(filesMap)),
    }),
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
      <T extends Model.PackageEntry | LocalFile | Model.S3File>() =>
      (filesDict: Record<string, T>) => {
        const file = filesDict[path]
        if (!file) return filesDict
        return R.assoc(path, addMetaToFile(file, meta), filesDict)
      }
    return R.evolve({
      added: mkSetMeta<LocalFile | Model.S3File>(),
      existing: mkSetMeta<Model.PackageEntry>(),
    })
  },
  Move:
    ({ source, dest }) =>
    (state) => {
      if (!source || !dest) return state

      const [sourceFile, sourcePrefix] = source
      return FilesEntry.match(
        {
          Dir: (entry) => {
            const sourcePath = sourcePrefix ? `${sourcePrefix}${entry.name}` : entry.name
            const [destDir, destPrefix] = dest
            const destPath = destPrefix
              ? `${destPrefix}${destDir.value.name}`
              : `${destDir.value.name}`
            if (hasDir(sourcePath, state.existing)) {
              return moveExistingDirectoryToAdded(sourcePath, destPath, state)
            }
            if (hasDir(sourcePath, state.added)) {
              return {
                ...state,
                added: renameKeys(sourcePath, destPath, state.added),
              }
            }
            throw new Error('Failed to move directory')
          },
          File: (entry) => {
            const sourcePath = sourcePrefix ? `${sourcePrefix}${entry.name}` : entry.name
            const [destDir, destPrefix] = dest
            const destPath = destPrefix
              ? `${destPrefix}${destDir.value.name}${entry.name}`
              : `${destDir.value.name}${entry.name}`

            if (state.existing[sourcePath]) {
              return moveExistingToAdded(sourcePath, destPath, state)
            }
            if (state.added[sourcePath]) {
              return {
                ...state,
                added: renameKey(sourcePath, destPath, state.added),
              }
            }
            throw new Error('Failed to move file')
          },
        },
        sourceFile,
      )
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

interface LocalEntry {
  path: string
  file: LocalFile
}

interface S3Entry {
  path: string
  file: Model.S3File
}

export const isS3File = (f: any): f is Model.S3File =>
  !!f &&
  typeof f === 'object' &&
  typeof f.bucket === 'string' &&
  typeof f.key === 'string' &&
  (typeof f.version === 'string' || typeof f.version === 'undefined') &&
  typeof f.size === 'number'

interface AddedFilesGroups {
  local: LocalEntry[]
  remote: S3Entry[]
}

export function groupAddedFiles(added: FilesState['added']) {
  return Object.entries(added)
    .filter(([, file]) => file !== EMPTY_DIR_MARKER)
    .reduce(
      ({ local, remote }, [path, file]) =>
        isS3File(file)
          ? { local, remote: remote.concat({ path, file }) }
          : { remote, local: local.concat({ path, file }) },
      { local: [], remote: [] } as AddedFilesGroups,
    )
}
