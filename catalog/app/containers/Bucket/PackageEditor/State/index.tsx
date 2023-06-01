import * as React from 'react'

import useBucket, { BucketContext } from './Bucket'
import useFiles, { FilesContext } from './Files'
import useManifest from './Manifest'
import useMessage, { MessageContext } from './Message'
import useMeta, { MetaContext } from './Meta'
import useName, { NameContext } from './Name'
import useMain, { MainContext } from './Main'
import useSource, { Src } from './Source'
import useWorkflow, { WorkflowContext } from './Workflow'

interface ContextData {
  bucket: BucketContext
  files: FilesContext
  main: MainContext
  message: MessageContext
  meta: MetaContext
  name: NameContext
  src: Src
  workflow: WorkflowContext
}

const Ctx = React.createContext<ContextData | null>(null)

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

export function Provider({
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
  const name = useName(src, bucket, workflow)
  const message = useMessage()
  const files = useFiles(src, workflow, manifest)
  const meta = useMeta(workflow, manifest)
  const main = useMain({ bucket, files, message, meta, name, workflow })
  const v = React.useMemo(
    () => ({
      bucket,
      files,
      message,
      main,
      meta,
      name,
      src,
      workflow,
    }),
    [bucket, files, message, main, meta, name, src, workflow],
  )
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}

export function useContext(): ContextData {
  const data = React.useContext(Ctx)
  if (!data) throw new Error('Set provider')
  return data
}

export const use = useContext
