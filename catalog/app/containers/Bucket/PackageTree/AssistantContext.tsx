import * as React from 'react'
import type { S3 } from 'aws-sdk'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as XML from 'utils/XML'

// Helper function for loading a single context file via LogicalKeyResolver
async function loadPackageContextFile(
  s3: S3,
  resolveLogicalKey: LogicalKeyResolver.LogicalKeyResolver,
  filePath: string,
): Promise<ContextFiles.ContextFileContent | null> {
  try {
    const resolved = await resolveLogicalKey(filePath)
    if (!resolved || !resolved.key) return null

    const response = await s3
      .getObject({
        Bucket: resolved.bucket,
        Key: resolved.key,
      })
      .promise()

    const content = response.Body?.toString('utf-8') || ''
    const truncated = content.length > ContextFiles.MAX_CONTEXT_FILE_SIZE
    const finalContent = truncated
      ? content.slice(0, ContextFiles.MAX_CONTEXT_FILE_SIZE)
      : content

    return {
      path: `/${filePath}`,
      content: finalContent,
      truncated,
    }
  } catch (error) {
    // 404s are expected, don't log them
    return null
  }
}

const MAX_METADATA_SIZE = 20_000

interface PackageMetadataContextProps {
  bucket: string
  name: string
  revision?: {
    hash: string
    modified?: any
    message?: string | null
    userMeta?: any
    workflow?: any
    totalEntries?: number | null
    totalBytes?: number | null
  } | null
}

export const PackageMetadataContext = Assistant.Context.LazyContext(
  ({ bucket, name, revision }: PackageMetadataContextProps) => {
    const messages = React.useMemo(() => {
      if (!revision) return []

      const msgs: string[] = []

      const systemData = {
        bucket,
        name,
        hash: revision.hash,
        modified: revision.modified,
        message: revision.message || null,
        workflow: revision.workflow || null,
        totalEntries: revision.totalEntries || null,
        totalBytes: revision.totalBytes || null,
      }
      msgs.push(
        XML.tag('package-info', {}, JSON.stringify(systemData, null, 2)).toString(),
      )

      if (revision.userMeta) {
        const metaStr = JSON.stringify(revision.userMeta, null, 2)
        const truncated = metaStr.length > MAX_METADATA_SIZE
        const attrs: XML.Attrs = truncated ? { truncated: 'true' } : {}
        msgs.push(
          XML.tag(
            'package-metadata',
            attrs,
            truncated ? metaStr.slice(0, MAX_METADATA_SIZE) : metaStr,
          ).toString(),
        )
      }

      return msgs
    }, [bucket, name, revision])

    return {
      markers: { packageMetadataReady: true },
      messages,
    }
  },
)

interface PackageRootContextProps {
  bucket: string
  name: string
  hash: string
}

export const PackageRootContext = Assistant.Context.LazyContext(
  ({ bucket, name, hash }: PackageRootContextProps) => {
    const s3 = AWS.S3.use()
    const resolveLogicalKey = LogicalKeyResolver.use()

    const loader = React.useCallback(async () => {
      if (!resolveLogicalKey) return []

      // Load all files in parallel
      const promises = ContextFiles.CONTEXT_FILE_NAMES.map((fileName) =>
        loadPackageContextFile(s3, resolveLogicalKey, fileName),
      )

      const results = await Promise.all(promises)
      return results.filter(
        (file): file is ContextFiles.ContextFileContent => file !== null,
      )
    }, [resolveLogicalKey, s3])

    const { files: contextFile, loading } = ContextFiles.useContextFileLoader(loader, [
      bucket,
      name,
      hash,
      resolveLogicalKey,
      s3,
    ])

    const messages = React.useMemo(() => {
      if (!contextFile || contextFile.length === 0) return []
      const attrs: ContextFiles.ContextFileAttributes = {
        scope: 'package',
        bucket,
        packageName: name,
      }
      return ContextFiles.formatContextFilesAsMessages(contextFile, attrs)
    }, [contextFile, bucket, name])

    return {
      markers: { packageContextFilesReady: !loading },
      messages,
    }
  },
)

interface PackageDirContextProps {
  bucket: string
  name: string
  hash: string
  path: string
}

export const PackageDirContext = Assistant.Context.LazyContext(
  ({ bucket, name, hash, path }: PackageDirContextProps) => {
    const s3 = AWS.S3.use()
    const resolveLogicalKey = LogicalKeyResolver.use()

    const loader = React.useCallback(async () => {
      if (!resolveLogicalKey) return []

      const pathSegments = path.split('/').filter(Boolean)

      // Build list of paths and filenames to check
      const pathsToCheck: string[] = []

      // Exclude root files (handled by PackageRootContext)
      for (let i = pathSegments.length; i > 0; i--) {
        const dirPath = pathSegments.slice(0, i).join('/')
        for (const fileName of ContextFiles.CONTEXT_FILE_NAMES) {
          pathsToCheck.push(`${dirPath}/${fileName}`)
        }
      }

      // Load files with limit (prioritize closer directories)
      const limitedPaths = pathsToCheck.slice(0, ContextFiles.MAX_NON_ROOT_FILES)

      // Load all files in parallel
      const promises = limitedPaths.map((filePath) =>
        loadPackageContextFile(s3, resolveLogicalKey, filePath),
      )

      const results = await Promise.all(promises)
      return results.filter(
        (file): file is ContextFiles.ContextFileContent => file !== null,
      )
    }, [path, resolveLogicalKey, s3])

    const { files: contextFiles, loading } = ContextFiles.useContextFileLoader(loader, [
      bucket,
      name,
      hash,
      path,
      resolveLogicalKey,
      s3,
    ])

    const messages = React.useMemo(() => {
      if (!contextFiles || contextFiles.length === 0) return []
      const attrs: ContextFiles.ContextFileAttributes = {
        scope: 'package',
        bucket,
        packageName: name,
      }
      return ContextFiles.formatContextFilesAsMessages(contextFiles, attrs)
    }, [contextFiles, bucket, name])

    return {
      markers: { packageDirContextFilesReady: !loading && contextFiles !== null },
      messages,
    }
  },
)
