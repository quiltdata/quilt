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
const MAX_CONTEXT_FILES = 10 // Maximum non-root context files to keep
const MAX_NON_ROOT_FILES_TO_TRY = 50 // Maximum non-root context files to try to find
const MAX_CONCURRENT_REQUESTS = 10 // Maximum concurrent file loading requests
const CONTEXT_FILE_NAMES = ['AGENTS.md', 'README.md']
const CACHE_CAPACITY = 100
const CACHE_TTL = Eff.Duration.minutes(30)

interface FileContent {
  content: string
  truncated: boolean
}

interface ContextFile extends FileContent {
  scope: ContextFileScope
  bucket: string
  path: string
}

type EffWithEx<A> = Eff.Effect.Effect<A, Eff.Cause.UnknownException>

type Loader = (loc: S3ObjectLocation) => EffWithEx<FileContent>

const LoaderContext = React.createContext<Loader | null>(null)

const liftPromise =
  <A, B>(f: (a: A) => Promise<B>) =>
  (a: A) =>
    Eff.Effect.tryPromise(() => f(a))

const loadObject = (s3: S3) => async (loc: S3ObjectLocation) => {
  // First HEAD the file to check its existence and get its size
  const head = await s3
    .headObject({ Bucket: loc.bucket, Key: loc.key, VersionId: loc.version })
    .promise()

  const fileSize = head.ContentLength || 0
  if (fileSize === 0) throw new Error('Empty file')

  const truncated = fileSize > MAX_CONTEXT_FILE_SIZE

  // Fetch only the range we need if file is large
  const result = await s3
    .getObject({
      Bucket: loc.bucket,
      Key: loc.key,
      VersionId: loc.version,
      Range: truncated ? `bytes=0-${MAX_CONTEXT_FILE_SIZE - 1}` : undefined,
    })
    .promise()

  const content = (result.Body?.toString('utf-8') || '').trim()
  if (!content) throw new Error('Empty file')

  return { truncated, content } as FileContent
}

function makeCachedLoader(lookup: Loader): Loader {
  const cache = runtime.runSync(
    Eff.Cache.make({
      capacity: CACHE_CAPACITY,
      timeToLive: CACHE_TTL,
      lookup,
    }),
  )

  return (loc: S3ObjectLocation) => cache.get(Eff.Data.struct(loc))
}

export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const s3 = AWS.S3.use()
  const loader = React.useMemo(() => makeCachedLoader(liftPromise(loadObject(s3))), [s3])
  return <LoaderContext.Provider value={loader}>{children}</LoaderContext.Provider>
}

function useLoader() {
  const loader = React.useContext(LoaderContext)
  invariant(loader, 'LoaderContext not provided')
  return loader
}

type ContextFileLoader = (path: string) => EffWithEx<ContextFile>

function useBucketContextFileLoader(bucket: string): ContextFileLoader {
  const load = useLoader()
  return React.useCallback(
    (path: string) =>
      load({ bucket, key: path }).pipe(
        Eff.Effect.map((c): ContextFile => ({ scope: 'bucket', bucket, path, ...c })),
      ),
    [bucket, load],
  )
}

function usePackageContextFileLoader(bucket: string): ContextFileLoader {
  const resolve = LogicalKeyResolver.useStrict()
  const load = useLoader()
  return React.useCallback(
    (path: string) =>
      Eff.Effect.tryPromise(async () => resolve(path)).pipe(
        Eff.Effect.flatMap(load),
        Eff.Effect.map((c): ContextFile => ({ scope: 'package', bucket, path, ...c })),
      ),
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

function usePathChain(path: string): string[] {
  return React.useMemo(
    () => buildPathChain(path).slice(0, MAX_NON_ROOT_FILES_TO_TRY),
    [path],
  )
}

function useContextFiles(marker: string, load: ContextFileLoader, paths: string[]) {
  const loadFiles = React.useCallback(
    () =>
      Eff.Effect.runPromise(
        Eff.Stream.fromIterable(paths).pipe(
          Eff.Stream.mapEffect(Eff.flow(load, Eff.Effect.option), {
            concurrency: MAX_CONCURRENT_REQUESTS,
          }),
          Eff.Stream.filterMap(Eff.identity),
          Eff.Stream.take(MAX_CONTEXT_FILES),
          Eff.Stream.map(format),
          Eff.Stream.runCollect,
          Eff.Effect.map(Eff.Chunk.toArray),
        ),
      ),
    [load, paths],
  )
  const r = Request.use(loadFiles)
  const ready = r !== Request.Loading && r !== Request.Idle
  const messages = ready && !(r instanceof Error) ? r : undefined
  return {
    markers: { [marker]: ready },
    messages,
  }
}

export function useBucketRootContextFiles(bucket: string) {
  return useContextFiles(
    'bucketRootContextFilesReady',
    useBucketContextFileLoader(bucket),
    CONTEXT_FILE_NAMES,
  )
}

export function useBucketDirContextFiles(bucket: string, path: string) {
  return useContextFiles(
    'bucketDirContextFilesReady',
    useBucketContextFileLoader(bucket),
    usePathChain(path),
  )
}

export function usePackageRootContextFiles(bucket: string) {
  return useContextFiles(
    'packageRootContextFilesReady',
    usePackageContextFileLoader(bucket),
    CONTEXT_FILE_NAMES,
  )
}

export function usePackageDirContextFiles(bucket: string, path: string) {
  return useContextFiles(
    'packageDirContextFilesReady',
    usePackageContextFileLoader(bucket),
    usePathChain(path),
  )
}

function format({ content, ...attrs }: ContextFile): string {
  return XML.tag('context-file', attrs, content).toString()
}
