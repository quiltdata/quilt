import type { S3 } from 'aws-sdk'
import * as XML from 'utils/XML'

export interface ContextFileContent {
  path: string
  content: string
  truncated: boolean
}

const MAX_CONTEXT_FILE_SIZE = 100_000 // 100KB default
const CONTEXT_FILE_NAME = 'README.md'

export async function loadContextFile(
  s3: S3,
  bucket: string,
  path: string,
): Promise<ContextFileContent | null> {
  try {
    const key = path ? `${path}/${CONTEXT_FILE_NAME}` : CONTEXT_FILE_NAME
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
    if (error.statusCode === 404 || error.code === 'NoSuchKey') {
      return null
    }
    // eslint-disable-next-line no-console
    console.error(`Error loading context file from ${path}:`, error)
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

  const promises = pathChain.map((path) => loadContextFile(s3, bucket, path))
  const results = await Promise.all(promises)

  return results.filter((content): content is ContextFileContent => content !== null)
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
    ? `\n[Content truncated at ${MAX_CONTEXT_FILE_SIZE}B]`
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
