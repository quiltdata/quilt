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

const MAX_CONTEXT_FILE_SIZE = 10_000
const MAX_CONTEXT_FILES = 10 // Maximum non-root context files to keep
const MAX_NON_ROOT_FILES_TO_TRY = 50 // Maximum non-root context files to look up
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

const makeCachedLoader = (lookup: Loader) =>
  Eff.Cache.make({ capacity: CACHE_CAPACITY, timeToLive: CACHE_TTL, lookup }).pipe(
    Eff.Effect.map(
      (cache): Loader =>
        (l) =>
          cache.get(Eff.Data.struct(l)),
    ),
  )

export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const s3 = AWS.S3.use()
  const loader = React.useMemo(
    () => runtime.runSync(makeCachedLoader(liftPromise(loadObject(s3)))),
    [s3],
  )
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
const buildPathChain = (path: string): string[] =>
  path
    ? [
        ...CONTEXT_FILE_NAMES.map((basename) => `${path}${basename}`),
        ...buildPathChain(S3Paths.up(path)),
      ]
    : []

const usePathChain = (path: string) =>
  React.useMemo(() => buildPathChain(path).slice(0, MAX_NON_ROOT_FILES_TO_TRY), [path])

function useContextFiles(marker: string, load: ContextFileLoader, paths: string[]) {
  const loadFiles = React.useCallback(
    () =>
      runtime.runPromise(
        Eff.Stream.fromIterable(paths).pipe(
          // Ignore file loading errors
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

export const useBucketRootContextFiles = (bucket: string) =>
  useContextFiles(
    'bucketRootContextFilesReady',
    useBucketContextFileLoader(bucket),
    CONTEXT_FILE_NAMES,
  )

export const useBucketDirContextFiles = (bucket: string, path: string) =>
  useContextFiles(
    'bucketDirContextFilesReady',
    useBucketContextFileLoader(bucket),
    usePathChain(path),
  )

export const usePackageRootContextFiles = (bucket: string) =>
  useContextFiles(
    'packageRootContextFilesReady',
    usePackageContextFileLoader(bucket),
    CONTEXT_FILE_NAMES,
  )

export const usePackageDirContextFiles = (bucket: string, path: string) =>
  useContextFiles(
    'packageDirContextFilesReady',
    usePackageContextFileLoader(bucket),
    usePathChain(path),
  )

const format = ({ content, ...attrs }: ContextFile) =>
  XML.tag('context-file', attrs, content).toString()
