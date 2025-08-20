import * as React from 'react'

import BucketOptions from '../../Download/BucketOptions'

import type { FileHandle } from '../types'

interface BucketFileOptionsProps {
  handle: FileHandle
  hideCode?: boolean
}

export default function BucketFileOptions({ handle, hideCode }: BucketFileOptionsProps) {
  return <BucketOptions handle={handle} hideCode={hideCode} />
}
