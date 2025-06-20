import * as React from 'react'

import * as AWS from 'utils/AWS'

import type { JsonSchema } from 'utils/JSONSchema'
import { getSchemaItemKeysOr } from 'utils/JSONSchema'
import { metadataSchema, workflowsConfig } from 'containers/Bucket/requests'
import type { WorkflowsConfig } from 'utils/workflows'

export const Loading = Symbol('loading')

export type RequestResult<T> = typeof Loading | Error | T

function useRequest<T>(req: () => Promise<T>, proceed: boolean = true): RequestResult<T> {
  const [result, setResult] = React.useState<RequestResult<T>>(Loading)

  const currentReq = React.useRef<Promise<T>>()

  React.useEffect(() => {
    setResult(Loading)

    if (!proceed) {
      currentReq.current = undefined
      return
    }

    const p = req()
    currentReq.current = p

    function handleResult(r: T | Error) {
      // if the request is not the current one, ignore the result
      if (currentReq.current === p) setResult(r)
    }

    p.then(handleResult, handleResult)
  }, [req, proceed])

  // cleanup on unmount
  React.useEffect(
    () => () => {
      currentReq.current = undefined
    },
    [],
  )

  return result
}

const noKeys: string[] = []

function useWorkflowConfig(bucket?: string) {
  const s3 = AWS.S3.use()
  const req = React.useCallback(async () => {
    if (!bucket) {
      throw new Error('Bucket is required')
    }
    return workflowsConfig({ s3, bucket })
  }, [s3, bucket])

  return useRequest<WorkflowsConfig>(req, !!bucket)
}

function useMetadataSchema(
  config: RequestResult<WorkflowsConfig>,
  selectedWorkflow?: string,
) {
  const s3 = AWS.S3.use()
  const req = React.useCallback(async () => {
    if (config === Loading) return config
    if (config instanceof Error) {
      throw config
    }
    if (config === null) return noKeys

    const workflow = selectedWorkflow
      ? getSelectedWorkflow(config, selectedWorkflow)
      : getBestWorkflow(config)

    if (workflow instanceof Error) {
      throw workflow
    }
    if (workflow === null) return noKeys

    const schemaUrl = workflow?.schema?.url
    if (!schemaUrl) {
      throw new Error('No schema URL found')
    }
    return metadataSchema({ s3, schemaUrl })
  }, [s3, config, selectedWorkflow])
  return useRequest<JsonSchema>(req, !(config === Loading || config instanceof Error))
}

function getBestWorkflow(config: WorkflowsConfig) {
  if (!config.workflows.length) {
    return null
  }

  if (config.workflows.length === 1) {
    return config.workflows[0]
  }

  return config.workflows.find((w) => w.isDefault) || null
}

function getSelectedWorkflow(config: WorkflowsConfig, selectedWorkflow?: string) {
  return (
    config.workflows.find((w) => w.slug === selectedWorkflow) ||
    new Error('Selected workflow not found')
  )
}

export function useMetadataRootKeys(bucket?: string, selectedWorkflow?: string) {
  const config = useWorkflowConfig(bucket)
  const schema = useMetadataSchema(config, selectedWorkflow)

  if (config === Loading || config instanceof Error) return config

  if (schema === Loading || schema instanceof Error) return schema

  return getSchemaItemKeysOr(schema, noKeys)
}
