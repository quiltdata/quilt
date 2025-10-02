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

async function loadContextFile(
  s3: S3,
  loc: S3ObjectLocation,
  ctx: ContextFileContext,
): Promise<ContextFile | null> {
  try {
    const response = await s3
      .getObject({
        Bucket: loc.bucket,
        Key: loc.key,
        VersionId: loc.version,
      })
      .promise()

    const fullContent = response.Body?.toString('utf-8') || ''
    const truncated = fullContent.length > MAX_CONTEXT_FILE_SIZE
    const content = truncated ? fullContent.slice(0, MAX_CONTEXT_FILE_SIZE) : fullContent

    return { content, truncated, ...ctx }
  } catch {
    // Context file could not be loaded, most likely because it doesn't exist
    return null
  }
}

export function useBucketRootContextFiles(bucket: string) {
  const s3 = AWS.S3.use()
  const load = React.useCallback(async () => {
    const results = await Promise.all(
      CONTEXT_FILE_NAMES.map((key) =>
        loadContextFile(s3, { bucket, key }, { scope: 'bucket', bucket, path: key }),
      ),
    )
    return results.filter((file): file is ContextFile => file !== null)
  }, [bucket, s3])
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

export function useBucketDirContextFiles(bucket: string, path: string) {
  const s3 = AWS.S3.use()

  const load = React.useCallback(async () => {
    const pathChain = buildPathChain(path)
    const results = await Promise.all(
      pathChain.map((key) =>
        loadContextFile(s3, { bucket, key }, { scope: 'bucket', bucket, path: key }),
      ),
    )
    return results
      .filter((file): file is ContextFile => file !== null)
      .slice(0, MAX_NON_ROOT_FILES)
  }, [bucket, path, s3])

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

async function loadPackageContextFile(
  s3: S3,
  resolveLogicalKey: LogicalKeyResolver.LogicalKeyResolver,
  logicalKey: string,
  ctx: Omit<ContextFileContext, 'path' | 'scope'>,
): Promise<ContextFile | null> {
  try {
    const resolved = await resolveLogicalKey(logicalKey)
    return await loadContextFile(s3, resolved, {
      scope: 'package',
      path: logicalKey,
      ...ctx,
    })
  } catch {
    // could not resolve logical key, most likely because it doesn't exist
    return null
  }
}

export function usePackageRootContextFiles(bucket: string, name: string) {
  const s3 = AWS.S3.use()
  const resolver = LogicalKeyResolver.useStrict()

  const load = React.useCallback(async () => {
    const results = await Promise.all(
      CONTEXT_FILE_NAMES.map((key) =>
        loadPackageContextFile(s3, resolver, key, { bucket, packageName: name }),
      ),
    )
    return results.filter((file): file is ContextFile => file !== null)
  }, [bucket, name, s3, resolver])

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

export function usePackageDirContextFiles(bucket: string, name: string, path: string) {
  const s3 = AWS.S3.use()
  const resolver = LogicalKeyResolver.useStrict()

  const load = React.useCallback(async () => {
    const pathChain = buildPathChain(path)
    const results = await Promise.all(
      pathChain.map((key) =>
        loadPackageContextFile(s3, resolver, key, { bucket, packageName: name }),
      ),
    )
    return results
      .filter((file): file is ContextFile => file !== null)
      .slice(0, MAX_NON_ROOT_FILES)
  }, [bucket, name, path, s3, resolver])

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
