import * as React from 'react'

import { ChatSkeleton } from 'components/Chat'
import * as Model from 'model'

import PageSection from '../Section'

const QuratorSummary = React.lazy(() => import('./Summary'))

interface QuratorSectionProps {
  handle: Model.S3.S3ObjectLocation
}

export default function QuratorSection({ handle }: QuratorSectionProps) {
  const children = React.useCallback(
    ({ expanded }) =>
      expanded && (
        <React.Suspense fallback={<ChatSkeleton />}>
          <QuratorSummary handle={handle} />
        </React.Suspense>
      ),
    [handle],
  )
  return (
    <PageSection
      gutterBottom
      gutterTop
      heading="Summarize and chat with AI"
      icon="assistant"
    >
      {children}
    </PageSection>
  )
}
