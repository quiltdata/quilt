import type { S3 } from 'aws-sdk'
import * as React from 'react'
import * as XML from 'utils/XML'

export interface ContextFileContent {
  path: string
  content: string
  truncated: boolean
}

export const MAX_CONTEXT_FILE_SIZE = 10_000 // 10KB default
export const MAX_NON_ROOT_FILES = 10 // Maximum non-root context files
export const CONTEXT_FILE_NAMES = ['AGENTS.md', 'README.md']

export async function loadContextFile(
  s3: S3,
  bucket: string,
  path: string,
  fileName: string = 'README.md',
): Promise<ContextFileContent | null> {
  try {
    const key = path ? `${path}/${fileName}` : fileName
    const response = await s3
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .promise()

    const content = response.Body?.toString('utf-8') || ''
    const truncated = content.length > MAX_CONTEXT_FILE_SIZE
    const finalContent = truncated ? content.slice(0, MAX_CONTEXT_FILE_SIZE) : content

    return {
      path: `/${key}`,
      content: finalContent,
      truncated,
    }
  } catch (error: any) {
    // 404s are expected when context files don't exist
    // Don't log them as they're not errors
    return null
  }
}

export function buildPathChain(currentPath: string, stopAt?: string): string[] {
  if (!currentPath) return []

  const segments = currentPath.split('/').filter(Boolean)
  const paths: string[] = []

  for (let i = segments.length; i > 0; i--) {
    const path = segments.slice(0, i).join('/')
    if (stopAt !== undefined && path === stopAt) break
    paths.push(path)
  }

  // Add root if not stopping at it
  // stopAt === undefined means include root
  // stopAt === '' means exclude root
  if (stopAt === undefined) {
    paths.push('')
  }

  return paths
}

export async function loadContextFileHierarchy(
  s3: S3,
  bucket: string,
  currentPath: string,
  stopAt?: string,
): Promise<ContextFileContent[]> {
  const pathChain = buildPathChain(currentPath, stopAt)
  const isRootPath = (path: string) => path === '' || path === stopAt

  // Load all context files (README.md and AGENTS.md) at each level
  const promises: Promise<ContextFileContent | null>[] = []
  const fileMetadata: { path: string; fileName: string; isRoot: boolean }[] = []

  for (const path of pathChain) {
    for (const fileName of CONTEXT_FILE_NAMES) {
      promises.push(loadContextFile(s3, bucket, path, fileName))
      fileMetadata.push({ path, fileName, isRoot: isRootPath(path) })
    }
  }

  const results = await Promise.all(promises)

  // Filter out nulls and associate with metadata
  const validFiles: (ContextFileContent & { isRoot: boolean })[] = []
  results.forEach((content, index) => {
    if (content !== null) {
      validFiles.push({ ...content, isRoot: fileMetadata[index].isRoot })
    }
  })

  // Separate root and non-root files
  const rootFiles = validFiles.filter((f) => f.isRoot)
  const nonRootFiles = validFiles.filter((f) => !f.isRoot)

  // Apply limit to non-root files (prioritize closer files, which come first in the array)
  const limitedNonRootFiles = nonRootFiles.slice(0, MAX_NON_ROOT_FILES)

  // Combine root files (always included) with limited non-root files
  return [...limitedNonRootFiles, ...rootFiles].map(({ isRoot, ...file }) => file)
}

export function buildPackagePathChain(
  packagePath: string,
  packageRoot: string,
): string[] {
  const paths: string[] = []

  // Build chain within package first
  if (packagePath && packagePath !== packageRoot) {
    const relativePath = packagePath.slice(packageRoot.length).replace(/^\//, '')
    const segments = relativePath.split('/').filter(Boolean)

    for (let i = segments.length; i > 0; i--) {
      paths.push(`${packageRoot}/${segments.slice(0, i).join('/')}`)
    }
  }

  // Add package root
  paths.push(packageRoot)

  // Add package parent directories up to bucket (but exclude bucket root)
  const packageParentSegments = packageRoot.split('/').filter(Boolean)
  for (let i = packageParentSegments.length - 1; i > 0; i--) {
    paths.push(packageParentSegments.slice(0, i).join('/'))
  }

  return paths
}

export interface ContextFileAttributes {
  scope: 'bucket' | 'package'
  bucket: string
  packageName?: string
}

export function formatContextFileAsXML(
  content: ContextFileContent,
  attrs?: ContextFileAttributes,
): string {
  const truncatedNote = content.truncated
    ? `\n[Content truncated at ${MAX_CONTEXT_FILE_SIZE.toLocaleString()} bytes]`
    : ''

  const xmlAttrs: Record<string, string> = {
    path: content.path,
    truncated: content.truncated.toString(),
  }

  if (attrs) {
    xmlAttrs.scope = attrs.scope
    xmlAttrs.bucket = attrs.bucket
    if (attrs.packageName) {
      xmlAttrs['package-name'] = attrs.packageName
    }
  }

  return XML.tag('context-file', xmlAttrs, content.content + truncatedNote).toString()
}

export function formatContextFilesAsMessages(
  files: ContextFileContent[],
  attrs?: ContextFileAttributes,
): string[] {
  if (files.length === 0) return []

  return files.map((file) => formatContextFileAsXML(file, attrs))
}

// Custom hook for loading context files with consistent error handling
export interface UseContextFileLoaderResult {
  files: ContextFileContent[] | null
  loading: boolean
  error: Error | null
}

export function useContextFileLoader(
  loader: () => Promise<ContextFileContent[]>,
  deps: React.DependencyList,
): UseContextFileLoaderResult {
  const [files, setFiles] = React.useState<ContextFileContent[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const loadFiles = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await loader()
        if (!cancelled) {
          setFiles(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setFiles([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadFiles()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { files, loading, error }
}
