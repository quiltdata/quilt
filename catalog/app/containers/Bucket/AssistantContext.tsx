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
      const loadContextFile = async () => {
        setLoading(true)
        try {
          const file = await ContextFiles.loadContextFile(s3, bucket, '')
          setContextFiles(file ? [file] : [])
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error loading bucket context file:', error)
          setContextFiles([])
        } finally {
          setLoading(false)
        }
      }

      loadContextFile()
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
