import * as React from 'react'

import type L from 'constants/loading'

import { Manifest } from '../../PackageDialog/Manifest'

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
  fields: {
    bucket: BucketContext
    files: FilesContext
    message: MessageContext
    meta: MetaContext
    name: NameContext
    workflow: WorkflowContext
  }
  main: MainContext
  src: Src
}

const Ctx = React.createContext<ContextData | null>(null)

interface WithSrcProps {
  src: Src
  bucket: BucketContext
  children: React.ReactNode
}

function WithSrc({ bucket, children, src }: WithSrcProps) {
  const manifest = useManifest(src)
  const workflow = useWorkflow(bucket.state?.value, manifest)

  return <WithWorkflow {...{ bucket, children, manifest, src, workflow }} />
}

interface WithWorkflowProps {
  bucket: BucketContext
  children: React.ReactNode
  manifest?: Manifest | typeof L
  src: Src
  workflow: WorkflowContext
}

function WithWorkflow({ bucket, children, manifest, src, workflow }: WithWorkflowProps) {
  const name = useName(src, bucket, workflow)
  const message = useMessage()
  const files = useFiles(workflow, manifest)
  const meta = useMeta(workflow, manifest)

  const fields = React.useMemo(
    () => ({ bucket, files, message, meta, name, workflow }),
    [bucket, files, message, meta, name, workflow],
  )
  const main = useMain()

  const value = React.useMemo(
    () => ({
      fields,
      main,
      src,
    }),
    [fields, main, src],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
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

export function Provider({
  bucket: srcBucket,
  name: srcName,
  hashOrTag,
  path,
  children,
}: ProviderProps) {
  const src = useSource(srcBucket, srcName, hashOrTag, path)
  const bucket = useBucket(src)
  return <WithSrc {...{ bucket, src, children }} />
}

export function useContext(): ContextData {
  const data = React.useContext(Ctx)
  if (!data) throw new Error('Set provider')
  return data
}

export const use = useContext
