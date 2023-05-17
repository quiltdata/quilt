import * as React from 'react'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { L } from 'components/Form/Package/types'
import { useRelevantBucketConfigs } from 'utils/BucketConfig'
import type { Workflow as WorkflowStruct } from 'utils/workflows'

import useWorkflowsConfig from './io/workflowsConfig'

export interface InputState {
  errors?: Error[] | typeof L
  value: string
}

export interface WorkflowState {
  errors?: Error[]
  value: WorkflowStruct | null
  workflows: WorkflowStruct[] | typeof L | Error
}

export interface BucketState {
  errors?: Error[]
  value: BucketConfig | null
  successors: BucketConfig[] | typeof L | Error
  buckets: BucketConfig[] | typeof L | Error
}

export interface PageState {
  bucket: string
}

interface BucketContext {
  state: BucketState
  actions: {
    onChange: (v: BucketConfig | null) => void
  }
}

interface MessageContext {
  state: InputState | typeof L
  actions: {
    onChange: (v: string) => void
  }
}

interface NameContext {
  state: InputState | typeof L
  actions: {
    onChange: (v: string) => void
  }
}

interface PageContext {
  state: PageState
}

interface WorkflowContext {
  state: WorkflowState | typeof L
  actions: {
    onChange: (v: WorkflowStruct | null) => void
  }
}

interface ContextData {
  bucket: BucketContext
  message: MessageContext
  name: NameContext
  page: PageContext
  workflow: WorkflowContext
}

function useBucket(bucket: string): BucketContext {
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
    return config.successors.map(({ slug }) => ({ ...bucketsMap[slug] }))
  }, [bucketsMap, config])
  return React.useMemo(
    () => ({
      state: {
        buckets,
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

function useMessage(): MessageContext {
  const [value, setValue] = React.useState('')
  return React.useMemo(
    () => ({
      state: {
        value,
      },
      actions: {
        onChange: setValue,
      },
    }),
    [value],
  )
}

function useName(): NameContext {
  const [value, setValue] = React.useState('')
  return React.useMemo(
    () => ({
      state: {
        value,
      },
      actions: {
        onChange: setValue,
      },
    }),
    [value],
  )
}

function usePage(bucket: string): PageContext {
  return React.useMemo(
    () => ({
      state: {
        bucket,
      },
    }),
    [bucket],
  )
}

function useWorkflow(dstBucket: BucketConfig | null): WorkflowContext {
  const config = useWorkflowsConfig(dstBucket?.name || null)
  const [value, setValue] = React.useState<WorkflowStruct | null>(null)
  const workflows = React.useMemo(() => {
    if (config === L || config instanceof Error) return config
    return config.workflows
  }, [config])
  return React.useMemo(
    () => ({
      state: {
        value,
        workflows,
      },
      actions: {
        onChange: setValue,
      },
    }),
    [value, workflows],
  )
}

const Ctx = React.createContext<ContextData | null>(null)

export function useContext(): ContextData {
  const data = React.useContext(Ctx)
  if (!data) throw new Error('Set provider')
  return data
}

interface ProviderProps {
  bucket: string
  name: string
  hashOrTag: string
  hash?: string
  path: string
  mode?: string
  resolvedFrom?: string
  size?: number
  children: React.ReactNode
}

export default function Provider({ bucket: srcBucket, children }: ProviderProps) {
  const page = usePage(srcBucket)
  const bucket = useBucket(srcBucket)
  const name = useName()
  const message = useMessage()
  const workflow = useWorkflow(bucket.state.value)
  const value = React.useMemo(
    () => ({
      page,
      bucket,
      name,
      message,
      workflow,
    }),
    [page, bucket, name, message, workflow],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
