import { useState } from 'react'

import { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { L } from 'components/Form/Package/types'
import type { Workflow as WorkflowStruct } from 'utils/workflows'

// import {
//   buckets,
//   successors,
// } from "../stories/PackageDialog/DestinationBucket";
// import { workflowsList } from "../stories/PackageDialog/Workflow";
const buckets: BucketConfig[] = []
const successors: BucketConfig[] = []
const workflowsList: WorkflowStruct[] = []

interface InputState {
  errors?: Error[] | typeof L
  value: string
}

interface WorkflowState {
  errors?: Error[]
  value: WorkflowStruct | null
  workflows: WorkflowStruct[] | typeof L | Error
}

interface BucketState {
  errors?: Error[]
  value: BucketConfig | null
  successors: BucketConfig[] | typeof L | Error
  buckets: BucketConfig[] | typeof L | Error
}

interface PageState {
  bucket: string
}

export interface State {
  bucket: BucketState
  message: InputState | typeof L
  name: InputState | typeof L
  page: PageState
  workflow: WorkflowState | typeof L
}

export default function useContainerState(bucket: string) {
  return useState<State>({
    page: {
      bucket,
    },
    bucket: {
      buckets,
      successors,
      value: null,
    },
    name: {
      value: '',
    },
    message: {
      value: '',
    },
    workflow: {
      value: null,
      workflows: workflowsList,
    },
  })
}
