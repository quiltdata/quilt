import * as React from 'react'

import Markdown from 'components/Markdown'
import Skeleton from 'components/Skeleton'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { Fetcher, useData } from 'utils/Data'

import * as requests from '../../requests'

function isNotebook(handle: Model.S3.S3ObjectLocation): boolean {
  return handle.key.toLowerCase().endsWith('.ipynb')
}

async function fetchReadmeText({
  s3,
  handle,
}: {
  s3: $TSFixMe
  handle: Model.S3.S3ObjectLocation
}): Promise<string> {
  const r = await s3.getObject({ Bucket: handle.bucket, Key: handle.key }).promise()
  return r.Body.toString('utf-8')
}

interface ReadmeContentsProps {
  handle: Model.S3.S3ObjectLocation
}

function ReadmeContents({ handle }: ReadmeContentsProps) {
  const s3 = AWS.S3.use()
  const data = useData(fetchReadmeText, { s3, handle })
  return data.case({
    // Errors must not break the header: render nothing.
    Err: () => null,
    Ok: (text: string) => (
      <div data-testid="readme-preview">
        <Markdown data={text} />
      </div>
    ),
    _: () => <Skeleton height={48} />,
  })
}

interface ReadmeProps {
  bucket: string
}

export default function Readme({ bucket }: ReadmeProps) {
  const s3 = AWS.S3.use()
  return (
    // @ts-expect-error untyped Fetcher
    <Fetcher fetch={requests.bucketReadmes} params={{ s3, bucket }}>
      {AsyncResult.case({
        Ok: (readmes: Model.S3.S3ObjectLocation[]) => {
          // NOTE: .ipynb is excluded from the compact header fold; a clamped
          // notebook reads poorly in a tight header. Full notebook rendering
          // remains available elsewhere (e.g. the Summary section).
          const handle = readmes.find((h) => !isNotebook(h))
          if (!handle) return null
          return <ReadmeContents handle={handle} />
        },
        _: () => <Skeleton height={48} />,
      })}
    </Fetcher>
  )
}
