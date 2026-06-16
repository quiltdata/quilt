import * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { Fetcher } from 'utils/Data'

import * as Summarize from '../../Summarize'
import * as requests from '../../requests'

function isNotebook(handle: Model.S3.S3ObjectLocation): boolean {
  return handle.key.toLowerCase().endsWith('.ipynb')
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
          return (
            <div data-testid="readme-preview">
              {/* No `expanded`: PreviewBox applies its native clamp + click-to-expand. */}
              <Summarize.FilePreview handle={handle} />
            </div>
          )
        },
        _: () => <Summarize.FilePreviewSkel />,
      })}
    </Fetcher>
  )
}
