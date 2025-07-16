import * as React from 'react'

import * as AWS from 'utils/AWS'

import type { JsonSchema } from 'utils/JSONSchema'
import { getSchemaItemKeysOr } from 'utils/JSONSchema'
import { metadataSchema, workflowsConfig } from 'containers/Bucket/requests'
import type { WorkflowsConfig } from 'utils/workflows'
import { notAvailable, notSelected } from 'utils/workflows'
import * as Request from 'utils/useRequest'

const noKeys: string[] = []

function useWorkflowConfig(bucket?: string) {
  const s3 = AWS.S3.use()
  const req = React.useCallback(async () => {
    if (!bucket) {
      throw new Error('Bucket is required')
    }
    return workflowsConfig({ s3, bucket })
  }, [s3, bucket])

  return Request.use<WorkflowsConfig>(req, !!bucket)
}

function useMetadataSchema(
  config: Request.Result<WorkflowsConfig>,
  selectedWorkflow?: string,
) {
  const s3 = AWS.S3.use()
  const req = React.useCallback(async () => {
    if (
      config === Request.Idle ||
      config === Request.Loading ||
      config instanceof Error
    ) {
      throw config
    }
    if (config === null) return noKeys

    const workflow = selectedWorkflow
      ? getSelectedWorkflow(config, selectedWorkflow)
      : getBestWorkflow(config)

    if (workflow instanceof Error) {
      throw workflow
    }
    if (
      workflow === null ||
      workflow.slug === notAvailable ||
      workflow.slug === notSelected
    ) {
      return noKeys
    }

    const schemaUrl = workflow?.schema?.url
    if (!schemaUrl) {
      throw new Error('No Schema URL found')
    }
    return metadataSchema({ s3, schemaUrl })
  }, [s3, config, selectedWorkflow])
  return Request.use<JsonSchema>(
    req,
    !(config === Request.Idle || config === Request.Loading || config instanceof Error),
  )
}

function getBestWorkflow({ workflows }: WorkflowsConfig) {
  return workflows.length === 1
    ? workflows[0]
    : workflows.find((w) => w.isDefault) || null
}

function getSelectedWorkflow({ workflows }: WorkflowsConfig, selectedWorkflow?: string) {
  return (
    workflows.find((w) => w.slug === selectedWorkflow) ||
    new Error('Selected workflow not found')
  )
}

export function useMetadataRootKeys(bucket?: string, selectedWorkflow?: string) {
  const config = useWorkflowConfig(bucket)
  const schema = useMetadataSchema(config, selectedWorkflow)

  if (config === Request.Loading || config === Request.Idle) return config
  if (config instanceof Error) {
    if (config.message) return config
    // eslint-disable-next-line no-console
    console.error(config)
    return new Error('Failed loading .quilt/workflows/config.yaml')
  }

  if (schema === Request.Loading || schema === Request.Idle) return schema
  if (schema instanceof Error) {
    if (schema.message) return schema
    // eslint-disable-next-line no-console
    console.error(schema)
    return new Error(`Failed loading JSON Schema for workflow`)
  }

  return getSchemaItemKeysOr(schema, noKeys)
}
