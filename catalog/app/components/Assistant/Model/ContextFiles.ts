import type { S3 } from 'aws-sdk'
import * as Eff from 'effect'
import * as React from 'react'

import type { S3ObjectLocation } from 'model/S3'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as XML from 'utils/XML'
import * as S3Paths from 'utils/s3paths'
import * as Request from 'utils/useRequest'

function resultToEffect<T>(
  r: Request.Result<T>,
): Eff.Option.Option<Eff.Either.Either<T, Error>> {
  if (r === Request.Idle || r === Request.Loading) return Eff.Option.none()
  const e = r instanceof Error ? Eff.Either.left(r) : Eff.Either.right(r)
  return Eff.Option.some(e)
}

function useContextFiles(load: () => Promise<ContextFile[]>) {
  const res = Request.use(load)
  return Eff.pipe(
    resultToEffect(res),
    Eff.Option.map(
      Eff.flow(
        Eff.Either.getOrElse(() => []),
        Eff.Array.map(format),
      ),
    ),
  )
}

type ContextFileScope = 'bucket' | 'package'

export const MAX_CONTEXT_FILE_SIZE = 10_000 // 10KB default
export const MAX_NON_ROOT_FILES = 10 // Maximum non-root context files
export const CONTEXT_FILE_NAMES = ['AGENTS.md', 'README.md']

interface ContextFileContext {
  scope: ContextFileScope
  bucket: string
  packageName?: string
  path: string
}

interface ContextFile extends ContextFileContext {
  content: string
  truncated: boolean
}

function useLoadContextFile() {
  const s3: S3 = AWS.S3.use()
  return React.useCallback(
    (loc: S3ObjectLocation, ctx: ContextFileContext): Promise<ContextFile | null> =>
      s3
        .getObject({ Bucket: loc.bucket, Key: loc.key, VersionId: loc.version })
        .promise()
        .then((r) => r.Body?.toString('utf-8') || '')
        .then((content) => ({
          truncated: content.length > MAX_CONTEXT_FILE_SIZE,
          content: content.slice(0, MAX_CONTEXT_FILE_SIZE),
          ...ctx,
        }))
        // could not load the file, most likely because it doesn't exist
        .catch(() => null),
    [s3],
  )
}

function useLoadPackageContextFile() {
  const resolve = LogicalKeyResolver.useStrict()
  const load = useLoadContextFile()
  return React.useCallback(
    (
      logicalKey: string,
      ctx: Omit<ContextFileContext, 'path' | 'scope'>,
    ): Promise<ContextFile | null> =>
      Promise.resolve(resolve(logicalKey))
        .then((loc) => load(loc, { scope: 'package', path: logicalKey, ...ctx }))
        // could not resolve the logical key, most likely because it doesn't exist
        .catch(() => null),
    [load, resolve],
  )
}

function buildPathChain(path: string): string[] {
  // FIXME: check edge cases, like leading/trailing slashes, multiple slashes, etc.
  return path
    ? [
        ...CONTEXT_FILE_NAMES.map(
          (basename) => `${S3Paths.ensureNoSlash(path)}/${basename}`,
        ),
        ...buildPathChain(S3Paths.up(path)),
      ]
    : []
}

export function useBucketRootContextFiles(bucket: string) {
  const loadFile = useLoadContextFile()
  const load = React.useCallback(async () => {
    const results = await Promise.all(
      CONTEXT_FILE_NAMES.map((key) =>
        loadFile({ bucket, key }, { scope: 'bucket', bucket, path: key }),
      ),
    )
    return results.filter((file): file is ContextFile => file !== null)
  }, [bucket, loadFile])
  return useContextFiles(load)
}

export function useBucketDirContextFiles(bucket: string, path: string) {
  const loadFile = useLoadContextFile()
  const load = React.useCallback(async () => {
    const pathChain = buildPathChain(path)
    const results = await Promise.all(
      pathChain.map((key) =>
        loadFile({ bucket, key }, { scope: 'bucket', bucket, path: key }),
      ),
    )
    return results
      .filter((file): file is ContextFile => file !== null)
      .slice(0, MAX_NON_ROOT_FILES)
  }, [bucket, path, loadFile])
  return useContextFiles(load)
}

export function usePackageRootContextFiles(bucket: string, name: string) {
  const loadFile = useLoadPackageContextFile()
  const load = React.useCallback(async () => {
    const results = await Promise.all(
      CONTEXT_FILE_NAMES.map((key) => loadFile(key, { bucket, packageName: name })),
    )
    return results.filter((file): file is ContextFile => file !== null)
  }, [bucket, name, loadFile])
  return useContextFiles(load)
}

export function usePackageDirContextFiles(bucket: string, name: string, path: string) {
  const loadFile = useLoadPackageContextFile()
  const load = React.useCallback(async () => {
    const pathChain = buildPathChain(path)
    const results = await Promise.all(
      pathChain.map((key) => loadFile(key, { bucket, packageName: name })),
    )
    return results
      .filter((file): file is ContextFile => file !== null)
      .slice(0, MAX_NON_ROOT_FILES)
  }, [bucket, name, path, loadFile])
  return useContextFiles(load)
}

export function format({ content, truncated, ...attrs }: ContextFile): string {
  return XML.tag(
    'context-file',
    attrs,
    content,
    truncated
      ? `[Content truncated at ${MAX_CONTEXT_FILE_SIZE.toLocaleString()} bytes]`
      : null,
  ).toString()
}
