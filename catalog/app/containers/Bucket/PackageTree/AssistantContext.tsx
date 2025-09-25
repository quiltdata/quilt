import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as XML from 'utils/XML'

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

      // System metadata in package-info tag
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

      // User metadata in package-metadata tag
      if (revision.userMeta) {
        msgs.push(
          XML.tag(
            'package-metadata',
            {},
            JSON.stringify(revision.userMeta, null, 2),
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
    const [contextFile, setContextFile] =
      React.useState<ContextFiles.ContextFileContent | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
      if (!resolveLogicalKey) {
        setLoading(false)
        return
      }

      const loadContext = async () => {
        setLoading(true)
        try {
          const resolved = await resolveLogicalKey('README.md')
          if (resolved && resolved.key) {
            const response = await s3
              .getObject({
                Bucket: resolved.bucket,
                Key: resolved.key,
              })
              .promise()

            const content = response.Body?.toString('utf-8') || ''
            const truncated = content.length > 100_000
            const finalContent = truncated ? content.slice(0, 100_000) : content

            setContextFile({
              path: '/README.md',
              content: finalContent,
              truncated,
            })
          } else {
            setContextFile(null)
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.debug('No README.md at package root or error loading:', error)
          setContextFile(null)
        } finally {
          setLoading(false)
        }
      }

      loadContext()
    }, [bucket, name, hash, resolveLogicalKey, s3])

    const messages = React.useMemo(() => {
      if (!contextFile) return []
      const attrs: ContextFiles.ContextFileAttributes = {
        scope: 'package',
        bucket,
        packageName: name,
      }
      return [ContextFiles.formatContextFileAsXML(contextFile, attrs)]
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
    const [contextFiles, setContextFiles] = React.useState<
      ContextFiles.ContextFileContent[] | null
    >(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
      if (!resolveLogicalKey) {
        setLoading(false)
        return
      }

      const loadContextFiles = async () => {
        setLoading(true)
        try {
          const pathSegments = path.split('/').filter(Boolean)
          const paths: string[] = []

          // Exclude root README (handled by PackageRootContext)
          for (let i = pathSegments.length; i > 0; i--) {
            const dirPath = pathSegments.slice(0, i).join('/')
            const readmePath = `${dirPath}/README.md`
            paths.push(readmePath)
          }

          const files: ContextFiles.ContextFileContent[] = []

          for (const readmePath of paths) {
            try {
              const resolved = await resolveLogicalKey(readmePath)
              if (resolved && resolved.key) {
                const response = await s3
                  .getObject({
                    Bucket: resolved.bucket,
                    Key: resolved.key,
                  })
                  .promise()

                const content = response.Body?.toString('utf-8') || ''
                const truncated = content.length > 100_000
                const finalContent = truncated ? content.slice(0, 100_000) : content

                files.push({
                  path: `/${readmePath}`,
                  content: finalContent,
                  truncated,
                })
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.debug(`No ${readmePath} in package:`, error)
            }
          }

          setContextFiles(files)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error loading package directory context files:', error)
          setContextFiles([])
        } finally {
          setLoading(false)
        }
      }

      loadContextFiles()
    }, [bucket, name, hash, path, resolveLogicalKey, s3])

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
