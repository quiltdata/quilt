import * as React from 'react'

import { ChatSkeleton } from 'components/Chat'
import * as Model from 'model'

import PageSection, { NodeRenderer } from '../Section'

const QuratorSummary = React.lazy(() => import('./Summary'))

interface QuratorSectionProps {
  handle: Model.S3.S3ObjectLocation
}

export default function QuratorSection({ handle }: QuratorSectionProps) {
  return (
    <PageSection
      gutterBottom
      gutterTop
      heading="Summarize and chat with AI"
      icon="assistant"
    >
      {({ expanded }: Parameters<NodeRenderer>[0]) =>
        expanded && (
          <React.Suspense fallback={<ChatSkeleton />}>
            <QuratorSummary handle={handle} />
          </React.Suspense>
        )
      }
    </PageSection>
  )
}
