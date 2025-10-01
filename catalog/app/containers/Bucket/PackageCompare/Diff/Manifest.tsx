import * as React from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import { trimCenter } from 'utils/string'

import type { RevisionResult } from '../useRevision'

interface ManifestDiffProps {
  left: RevisionResult
  right: RevisionResult
}

export default function ManifestDiff({ left: left, right: right }: ManifestDiffProps) {
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

  const leftData = left.revision.contentsFlatMap
  const rightData = right.revision.contentsFlatMap

  const leftManifestString = leftData ? JSON.stringify(leftData, null, 2) : ''
  const rightManifestString = rightData ? JSON.stringify(rightData, null, 2) : ''

  if (leftManifestString === rightManifestString) {
    return (
      <M.Typography
        variant="body2"
        color="textSecondary"
        style={{ fontStyle: 'italic', textAlign: 'center', padding: 16 }}
      >
        Manifest entries are identical
      </M.Typography>
    )
  }

  return (
    <ReactDiffViewer
      oldValue={leftManifestString}
      newValue={rightManifestString}
      splitView={true}
      leftTitle={trimCenter(left.revision.hash, 15)}
      rightTitle={trimCenter(right.revision.hash, 15)}
      showDiffOnly={false}
      hideLineNumbers={false}
    />
  )
}
