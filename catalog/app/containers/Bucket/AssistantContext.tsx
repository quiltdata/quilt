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

    const loader = React.useCallback(async () => {
      // Load both README.md and AGENTS.md from bucket root
      const promises = [
        ContextFiles.loadContextFile(s3, bucket, '', 'README.md'),
        ContextFiles.loadContextFile(s3, bucket, '', 'AGENTS.md'),
      ]
      const results = await Promise.all(promises)
      return results.filter(
        (file): file is ContextFiles.ContextFileContent => file !== null,
      )
    }, [bucket, s3])

    const { files: contextFiles, loading } = ContextFiles.useContextFileLoader(loader, [
      bucket,
      s3,
    ])

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
