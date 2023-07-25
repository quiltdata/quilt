import * as React from 'react'

import L from 'constants/loading'
import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { useRelevantBucketConfigs } from 'utils/BucketConfig'

import useWorkflowsConfig from '../io/workflowsConfig'

import type { Src } from './Source'
import NOT_READY from './errorNotReady'

export interface BucketState {
  value: BucketConfig | null
  successors: BucketConfig[] | typeof L | Error
  buckets: BucketConfig[] | typeof L | Error
}

export interface BucketContext {
  state: BucketState
  getters: {
    formData: () => string
    submitDisabled: () => boolean
  }
  actions: {
    onChange: (v: BucketConfig | null) => void
  }
}

function getFormData(state: BucketState) {
  if (!state.value) {
    throw NOT_READY
  }
  return state.value.name
}

function isDisabled(state: BucketState) {
  return !state.value
}

export default function useBucket({ bucket }: Src): BucketContext {
  const buckets = useRelevantBucketConfigs()
  const bucketsMap = React.useMemo(
    () =>
      buckets.reduce(
        (memo, b) => ({
          ...memo,
          [b.name]: b,
        }),
        {} as Record<string, BucketConfig>,
      ),
    [buckets],
  )
  const [value, setValue] = React.useState<BucketConfig | null>(
    bucketsMap[bucket] || null,
  )
  const config = useWorkflowsConfig(bucket)
  const successors = React.useMemo(() => {
    if (config === L || config instanceof Error) return config
    return config.successors.map(({ slug }) => bucketsMap[slug])
  }, [bucketsMap, config])

  const state: BucketState = React.useMemo(
    () => ({
      buckets: Array.isArray(successors)
        ? buckets.filter((b) => !successors.includes(b))
        : buckets,
      successors,
      value,
    }),
    [buckets, successors, value],
  )

  return React.useMemo(
    () => ({
      state,
      getters: {
        formData: () => getFormData(state),
        submitDisabled: () => isDisabled(state),
      },
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}
