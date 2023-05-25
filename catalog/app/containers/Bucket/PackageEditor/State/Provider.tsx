import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type * as Types from 'utils/types'
import type { Schema } from 'utils/workflows'

import type { Manifest } from '../../PackageDialog/Manifest'

import useSource, { Src } from './Source'
import useManifest from './Manifest'
import useBucket, { BucketContext } from './Bucket'
import useWorkflow, { WorkflowContext } from './Workflow'

export interface InputState {
  errors?: Error[] | typeof L
  value: string
}

export interface MetaState {
  value?: Types.JsonRecord
  schema?: Schema
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

interface ContextData {
  bucket: BucketContext
  message: MessageContext
  meta: MetaContext
  name: NameContext
  workflow: WorkflowContext
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
  const src = useSource(srcBucket, srcName, hashOrTag, path)
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
    [bucket, message, meta, name, workflow],
  )
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}
