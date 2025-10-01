import * as React from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import { trimCenter } from 'utils/string'

import type { RevisionResult } from '../useRevision'

interface MetadataDiffProps {
  left: RevisionResult
  right: RevisionResult
}

export default function MetadataDiff({ left: left, right: right }: MetadataDiffProps) {
  if (left._tag === 'idle' || right._tag === 'idle') {
    return null
  }

  if (left._tag === 'loading' || right._tag === 'loading') {
    return <Skeleton width="100%" height={200} />
  }

  if (left._tag === 'error' || right._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  const leftMetadata = left.revision.userMeta || {}
  const rightMetadata = right.revision.userMeta || {}

  const leftMetadataString = JSON.stringify(leftMetadata, null, 2)
  const rightMetadataString = JSON.stringify(rightMetadata, null, 2)

  if (leftMetadataString === rightMetadataString) {
    return (
      <M.Typography
        variant="body2"
        color="textSecondary"
        style={{ fontStyle: 'italic', textAlign: 'center', padding: 16 }}
      >
        Metadata is identical
      </M.Typography>
    )
  }

  return (
    <ReactDiffViewer
      oldValue={leftMetadataString}
      newValue={rightMetadataString}
      splitView={true}
      leftTitle={trimCenter(left.revision.hash, 15)}
      rightTitle={trimCenter(right.revision.hash, 15)}
      showDiffOnly={false}
      hideLineNumbers={false}
    />
  )
}
