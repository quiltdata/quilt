import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as XML from 'utils/XML'

interface PackageMetadataContextProps {
  name: string
  hash: string
  created?: Date
  message?: string
}

export const PackageMetadataContext = Assistant.Context.LazyContext(
  ({ name, hash, created, message }: PackageMetadataContextProps) => {
    const msg = React.useMemo(() => {
      const metadata = {
        name,
        hash,
        created: created?.toISOString(),
        message: message || null,
      }

      return XML.tag('package-metadata', {}, JSON.stringify(metadata, null, 2)).toString()
    }, [name, hash, created, message])

    return {
      markers: { packageMetadataReady: true },
      messages: [msg],
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
      return [ContextFiles.formatContextFileAsXML(contextFile)]
    }, [contextFile])

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
      return ContextFiles.formatContextFilesAsMessages(contextFiles)
    }, [contextFiles])

    return {
      markers: { packageDirContextFilesReady: !loading && contextFiles !== null },
      messages,
    }
  },
)
