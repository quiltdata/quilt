import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as AWS from 'utils/AWS'

interface BucketContextProps {
  bucket: string
}

export const BucketContext = Assistant.Context.LazyContext(
  ({ bucket }: BucketContextProps) => {
    const s3 = AWS.S3.use()
    const [contextFiles, setContextFiles] = React.useState<
      ContextFiles.ContextFileContent[] | null
    >(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
      const loadContextFiles = async () => {
        setLoading(true)
        try {
          // Load both README.md and AGENTS.md from bucket root
          const promises = [
            ContextFiles.loadContextFile(s3, bucket, '', 'README.md'),
            ContextFiles.loadContextFile(s3, bucket, '', 'AGENTS.md'),
          ]
          const results = await Promise.all(promises)
          const validFiles = results.filter(
            (file): file is ContextFiles.ContextFileContent => file !== null,
          )
          setContextFiles(validFiles)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error loading bucket context files:', error)
          setContextFiles([])
        } finally {
          setLoading(false)
        }
      }

      loadContextFiles()
    }, [bucket, s3])

    const messages = React.useMemo(() => {
      if (!contextFiles || contextFiles.length === 0) return []
      const attrs: ContextFiles.ContextFileAttributes = {
        scope: 'bucket',
        bucket,
      }
      return ContextFiles.formatContextFilesAsMessages(contextFiles, attrs)
    }, [contextFiles, bucket])

    return {
      markers: { bucketContextFilesReady: !loading && contextFiles !== null },
      messages,
    }
  },
)
