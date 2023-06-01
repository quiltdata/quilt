import * as React from 'react'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { L } from 'components/Form/Package/types'
import { useRelevantBucketConfigs } from 'utils/BucketConfig'

import useWorkflowsConfig from '../io/workflowsConfig'

import type { Src } from './Source'

export interface BucketState {
  errors?: Error[]
  value: BucketConfig | null
  successors: BucketConfig[] | typeof L | Error
  buckets: BucketConfig[] | typeof L | Error
}

export interface BucketContext {
  state: BucketState
  actions: {
    onChange: (v: BucketConfig | null) => void
  }
}

export default function useBucket({ bucket }: Src): BucketContext {
  const buckets = useRelevantBucketConfigs()
  const bucketsMap = buckets.reduce(
    (memo, b) => ({
      ...memo,
      [b.name]: b,
    }),
    {} as Record<string, BucketConfig>,
  )
  const [value, setValue] = React.useState<BucketConfig | null>(
    bucketsMap[bucket] || null,
  )
  const config = useWorkflowsConfig(bucket)
  const successors = React.useMemo(() => {
    if (config === L || config instanceof Error) return config
    return config.successors.map(({ slug }) => bucketsMap[slug])
  }, [bucketsMap, config])
  return React.useMemo(
    () => ({
      state: {
        buckets: Array.isArray(successors)
          ? buckets.filter((b) => !successors.includes(b))
          : buckets,
        successors,
        value,
      },
      actions: {
        onChange: setValue,
      },
    }),
    [buckets, successors, value],
  )
}
