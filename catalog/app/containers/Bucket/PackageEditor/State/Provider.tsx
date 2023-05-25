import * as R from 'ramda'
import * as React from 'react'

import type { BucketConfig } from 'components/Form/Package/DestinationBucket'
import { L } from 'components/Form/Package/types'
import AsyncResult from 'utils/AsyncResult'
import { useRelevantBucketConfigs } from 'utils/BucketConfig'
import type * as Types from 'utils/types'
import { Schema, Workflow as WorkflowStruct, notSelected } from 'utils/workflows'

import { Manifest, useManifest as useFetchManifest } from '../../PackageDialog/Manifest'

import useWorkflowsConfig from '../io/workflowsConfig'

interface Src {
  bucket: string
  packageHandle?: { name: string; hashOrTag: string }
  s3Path?: string
}

export interface InputState {
  errors?: Error[] | typeof L
  value: string
}

export interface MetaState {
  value?: Types.JsonRecord
  schema?: Schema
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

interface MetaContext {
  state: MetaState | typeof L
}

interface NameContext {
  state: InputState | typeof L
  actions: {
    onChange: (v: string) => void
  }
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
  meta: MetaContext
  name: NameContext
  workflow: WorkflowContext
}

function useBucket({ bucket }: Src): BucketContext {
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

function useName(src: Src, workflow: WorkflowContext): NameContext {
  const [value, setValue] = React.useState(src.packageHandle?.name || '')
  const state = React.useMemo(
    () => (workflow.state === L ? L : { value }),
    [value, workflow.state],
  )
  return React.useMemo(
    () => ({
      state,
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}

function useWorkflowsList(
  bucket: BucketConfig | null,
): WorkflowStruct[] | typeof L | Error {
  const config = useWorkflowsConfig(bucket?.name || null)
  return React.useMemo(() => {
    if (config === L || config instanceof Error) return config
    return config.workflows
  }, [config])
}

function getDefaultWorkflow(workflows: WorkflowStruct[], manifest?: Manifest) {
  return (
    workflows.find((w) => w.slug === manifest?.workflowId) ||
    workflows.find((w) => w.isDefault) ||
    workflows.find((w) => w.slug === notSelected) ||
    null
  )
}

function useWorkflow(
  bucket: BucketConfig | null,
  manifest?: Manifest | typeof L,
): WorkflowContext {
  const [value, setValue] = React.useState<WorkflowStruct | null>(null)

  const workflows = useWorkflowsList(bucket)

  const state = React.useMemo(() => {
    if (manifest === L || workflows === L) return L
    if (workflows instanceof Error) return { value: null, workflows }
    if (value) return { value, workflows }
    return {
      value: getDefaultWorkflow(workflows, manifest),
      workflows,
    }
  }, [manifest, value, workflows])

  return React.useMemo(
    () => ({
      state,
      actions: {
        onChange: setValue,
      },
    }),
    [state],
  )
}

function useMeta(workflow: WorkflowContext, manifest?: Manifest | typeof L): MetaContext {
  const state = React.useMemo(() => {
    if (manifest === L || workflow.state === L) return L
    return {
      value: manifest?.meta,
      schema: workflow.state.value?.schema,
    }
  }, [workflow.state, manifest])
  return React.useMemo(
    () => ({
      state,
    }),
    [state],
  )
}

const Ctx = React.createContext<ContextData | null>(null)

export function useContext(): ContextData {
  const data = React.useContext(Ctx)
  if (!data) throw new Error('Set provider')
  return data
}

function useManifest(src: Src): Manifest | typeof L | undefined {
  const manifestData = useFetchManifest({
    bucket: src.bucket,
    name: src.packageHandle!.name,
    hashOrTag: src.packageHandle?.hashOrTag,
    pause: !src.packageHandle?.name,
  })
  return React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: R.identity,
          Pending: () => L,
          _: () => undefined, // FIXME
        },
        src.packageHandle ? manifestData.result : AsyncResult.Ok(),
      ),
    [manifestData.result, src.packageHandle],
  )
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

export default function Provider({
  bucket: srcBucket,
  name: srcName,
  hashOrTag,
  path,
  children,
}: ProviderProps) {
  const src: Src = React.useMemo(
    () => ({
      bucket: srcBucket,
      packageHandle: srcName && hashOrTag ? { name: srcName, hashOrTag } : undefined,
      s3Path: path,
    }),
    [srcBucket, srcName, hashOrTag, path],
  )
  const bucket = useBucket(src)

  const manifest = useManifest(src)
  const workflow = useWorkflow(bucket.state?.value, manifest)
  const name = useName(src, workflow)
  const message = useMessage()
  const meta = useMeta(workflow, manifest)
  const v = React.useMemo(
    () => ({
      bucket,
      message,
      name,
      workflow,
      meta,
    }),
    [bucket, message, name, workflow],
  )
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}
