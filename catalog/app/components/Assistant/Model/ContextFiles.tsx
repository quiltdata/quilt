import type { S3 } from 'aws-sdk'
import * as Eff from 'effect'
import invariant from 'invariant'
import * as React from 'react'

import type { S3ObjectLocation } from 'model/S3'
import * as AWS from 'utils/AWS'
import { runtime } from 'utils/Effect'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as XML from 'utils/XML'
import * as S3Paths from 'utils/s3paths'
import * as Request from 'utils/useRequest'

type ContextFileScope = 'bucket' | 'package'

const MAX_CONTEXT_FILE_SIZE = 10_000 // 10KB default
const MAX_NON_ROOT_FILES = 10 // Maximum non-root context files to keep
const MAX_NON_ROOT_FILES_TO_TRY = 50 // Maximum non-root context files to try to find
const CONTEXT_FILE_NAMES = ['AGENTS.md', 'README.md']
const CACHE_CAPACITY = 50
const CACHE_TTL = Eff.Duration.minutes(10)

interface ContextFileContent {
  content: string
  truncated: boolean
}

interface ContextFile extends ContextFileContent {
  scope: ContextFileScope
  bucket: string
  path: string
}

function useMakeLoader() {
  const s3: S3 = AWS.S3.use()
  const loadFile = React.useCallback(
    (loc: S3ObjectLocation): Promise<ContextFileContent | null> =>
      s3
        .getObject({ Bucket: loc.bucket, Key: loc.key, VersionId: loc.version })
        .promise()
        .then((r) => r.Body?.toString('utf-8') || '')
        .then((content) => ({
          truncated: content.length > MAX_CONTEXT_FILE_SIZE,
          content: content.slice(0, MAX_CONTEXT_FILE_SIZE),
        }))
        // could not load the file, most likely because it doesn't exist
        .catch(() => null),
    [s3],
  )

  const cache = React.useMemo(
    () =>
      runtime.runSync(
        Eff.Cache.make({
          capacity: CACHE_CAPACITY,
          timeToLive: CACHE_TTL,
          lookup: (loc: S3ObjectLocation) => Eff.Effect.promise(() => loadFile(loc)),
        }),
      ),
    [loadFile],
  )

  return React.useCallback(
    (loc: S3ObjectLocation) => Eff.Effect.runPromise(cache.get(Eff.Data.struct(loc))),
    [cache],
  )
}

type Loader = ReturnType<typeof useMakeLoader>

const LoaderContext = React.createContext<Loader | null>(null)

export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const loader = useMakeLoader()
  return <LoaderContext.Provider value={loader}>{children}</LoaderContext.Provider>
}

function useLoadFile() {
  const loader = React.useContext(LoaderContext)
  invariant(loader, 'LoaderContext not provided')
  return loader
}

function useLoadBucketContextFile(bucket: string) {
  const load = useLoadFile()
  return React.useCallback(
    (path: string): Promise<ContextFile | null> =>
      load({ bucket, key: path }).then(
        (content) => content && { scope: 'bucket', bucket, path, ...content },
      ),
    [bucket, load],
  )
}

function useLoadPackageContextFile(bucket: string) {
  const resolve = LogicalKeyResolver.useStrict()
  const load = useLoadFile()
  return React.useCallback(
    (path: string): Promise<ContextFile | null> =>
      Promise.resolve(resolve(path))
        .then(load)
        // could not resolve the logical key, most likely because it doesn't exist
        .catch(() => null)
        .then((content) => content && { scope: 'package', bucket, path, ...content }),
    [bucket, load, resolve],
  )
}

// `path` is expected to be a "directory"/"prefix" path, i.e. it should end with `/` or be empty
function buildPathChain(path: string): string[] {
  return path
    ? [
        ...CONTEXT_FILE_NAMES.map((basename) => `${path}${basename}`),
        ...buildPathChain(S3Paths.up(path)),
      ]
    : []
}

function useBuildPathChain(path: string): string[] {
  return React.useMemo(
    () => buildPathChain(path).slice(0, MAX_NON_ROOT_FILES_TO_TRY),
    [path],
  )
}

function useContextFiles(
  marker: string,
  load: (path: string) => Promise<ContextFile | null>,
  paths: string[],
  limit?: number,
) {
  const loadFiles = React.useCallback(
    () =>
      Promise.all(paths.map(load))
        .then((results) => results.filter((file): file is ContextFile => !!file))
        .then((files) => (limit ? files.slice(0, limit) : files)),
    [load, paths, limit],
  )
  const r = Request.use(loadFiles)
  const ready = r !== Request.Loading && r !== Request.Idle
  const messages = React.useMemo(
    () =>
      r === Request.Loading || r === Request.Idle || r instanceof Error
        ? []
        : r.map(format),
    [r],
  )
  return {
    markers: { [marker]: ready },
    messages,
  }
}

export function useBucketRootContextFiles(bucket: string) {
  return useContextFiles(
    'bucketRootContextFilesReady',
    useLoadBucketContextFile(bucket),
    CONTEXT_FILE_NAMES,
  )
}

export function useBucketDirContextFiles(bucket: string, path: string) {
  return useContextFiles(
    'bucketDirContextFilesReady',
    useLoadBucketContextFile(bucket),
    useBuildPathChain(path),
    MAX_NON_ROOT_FILES,
  )
}

export function usePackageRootContextFiles(bucket: string) {
  return useContextFiles(
    'packageRootContextFilesReady',
    useLoadPackageContextFile(bucket),
    CONTEXT_FILE_NAMES,
  )
}

export function usePackageDirContextFiles(bucket: string, path: string) {
  return useContextFiles(
    'packageDirContextFilesReady',
    useLoadPackageContextFile(bucket),
    useBuildPathChain(path),
    MAX_NON_ROOT_FILES,
  )
}

function format({ content, truncated, ...attrs }: ContextFile): string {
  return XML.tag(
    'context-file',
    attrs,
    content,
    truncated
      ? `[Content truncated at ${MAX_CONTEXT_FILE_SIZE.toLocaleString()} bytes]`
      : null,
  ).toString()
}
