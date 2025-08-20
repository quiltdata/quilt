import * as React from 'react'

import BucketOptions from '../../Download/BucketOptions'

import type { DirHandle } from '../types'

interface BucketOptionsProps {
  handle: DirHandle
  hideCode?: boolean
}

export default function BucketDirOptions({ handle, hideCode }: BucketOptionsProps) {
  return <BucketOptions handle={handle} hideCode={hideCode} />
}
