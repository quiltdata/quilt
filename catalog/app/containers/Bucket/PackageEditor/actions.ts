import * as R from 'ramda'
import * as React from 'react'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { useRelevantBucketConfigs } from 'utils/BucketConfig'
import { useSuccessors } from 'containers/Bucket/Successors'
import { L } from 'components/Form/Package/types'
import type { Workflow as WorkflowStruct } from 'utils/workflows'

import useWorkflowsConfig from './io/workflowsConfig'

import type { State } from './state'
import Reducers, { Reducer } from './reducers'

async function validateName(value: string): Promise<Error[] | false> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (value === 'foo/bar') {
        return resolve([new Error('Package name invalid')])
      }
      resolve(false)
    }, 1000)
  })
}

function validateMessage(value: string): Error[] | false {
  return value ? false : [new Error('Commit message is required')]
}

function useBucketActions(state: State, setState: (r: Reducer) => void) {
  const reducers = Reducers.bucket
  const loadWorkflowsConfig = useWorkflowsConfig()
  const buckets = useRelevantBucketConfigs()

  return {
    onPageLoad: async () => {
      setState(reducers.setBuckets(buckets.map(R.pick(['name', 'title', 'description']))))
      try {
        setState(reducers.setSuccessors(L))
        const { successors } = await loadWorkflowsConfig(state.page.bucket)
        setState(
          reducers.setSuccessors(
            successors.map(({ name, slug }) => ({
              title: name,
              name: slug,
              description: '',
            })),
          ),
        )
      } catch (error) {
        if (error instanceof Error) {
          setState(reducers.setSuccessors(error))
        }
      }
    },
    onChange: (value: BucketConfig | null) => {
      setState(R.pipe(reducers.setValue(value), reducers.startFetching()))
      setTimeout(() => setState(reducers.fetched()), 1000)
    },
  }
}

function useMessageActions(setState: (r: Reducer) => void) {
  return {
    onChange: async (value: string) => {
      const reducers = Reducers.message
      setState(R.pipe(reducers.setValue(value), reducers.setErrors(L)))
      const errors = validateMessage(value)
      setState(reducers.setErrors(errors || undefined))
    },
  }
}

function useNameActions(setState: (r: Reducer) => void) {
  return {
    onChange: async (value: string) => {
      const reducers = Reducers.name
      setState(R.pipe(reducers.setValue(value), reducers.setErrors(L)))
      const errors = await validateName(value)
      setState(reducers.setErrors(errors || undefined))
    },
  }
}

function useWorkflowActions(setState: (r: Reducer) => void) {
  return {
    onChange: (value: WorkflowStruct | null) => {
      const reducers = Reducers.workflow
      setState(R.pipe(reducers.setValue(value), reducers.startFetching()))
      setTimeout(() => setState(reducers.fetched()), 1000)
    },
  }
}

export interface Actions {
  workflow: {
    onChange: (v: WorkflowStruct | null) => void
  }
  bucket: {
    onPageLoad: () => void
    onChange: (v: BucketConfig | null) => void
  }
  message: {
    onChange: (v: string) => void
  }
  name: {
    onChange: (v: string) => Promise<void>
  }
}

export default function useActions(state: State, setState: (s: Reducer) => void) {
  const bucket = useBucketActions(state, setState)
  const message = useMessageActions(setState)
  const name = useNameActions(setState)
  const workflow = useWorkflowActions(setState)
  return React.useMemo(
    () => ({
      bucket,
      message,
      name,
      workflow,
    }),
    [bucket, message, name, workflow],
  )
}
