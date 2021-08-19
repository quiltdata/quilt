import * as R from 'ramda'

import { makeSchemaValidator } from 'utils/json-schema'
import * as packageHandle from 'utils/packageName'
import * as s3paths from 'utils/s3paths'
import yaml from 'utils/yaml'
import workflowsConfigSchema from 'schemas/workflows.yml.json'
import * as bucketErrors from 'containers/Bucket/errors'

interface WorkflowsYaml {
  version: '1'
  is_workflow_required?: boolean
  default_workflow?: string
  package_handle?: packageHandle.Handles
  workflows: Record<string, WorkflowYaml>
  schemas?: Record<string, Schema>
  successors?: Record<string, SuccessorYaml>
}

interface WorkflowYaml {
  name: string
  description?: string
  metadata_schema?: string
  package_handle?: packageHandle.Handles
  is_message_required?: boolean
}

interface SuccessorYaml {
  title: string
  copy_data?: boolean
}

export interface Successor {
  name: string
  slug: string
  url: string
  copyData: boolean
}

export interface Schema {
  url: string
}

export interface Workflow {
  description?: string
  isDefault: boolean
  isDisabled: boolean
  name?: string
  packageHandle: Required<packageHandle.Handles>
  schema?: Schema
  slug: string | typeof notAvailable | typeof notSelected
}

export interface WorkflowsConfig {
  isWorkflowRequired: boolean
  packageHandle: Required<packageHandle.Handles>
  successors: Successor[]
  workflows: Workflow[]
}

const defaultPackageHandle = {
  files: '',
  packages: '',
}

export const notAvailable = Symbol('not available')

const parsePackageHandle = (
  globalHandle?: packageHandle.Handles,
  workflowHandle?: packageHandle.Handles,
): Required<packageHandle.Handles> => ({
  ...defaultPackageHandle,
  ...globalHandle,
  ...workflowHandle,
})

export const notSelected = Symbol('not selected')

function getNoWorkflow(data: WorkflowsYaml, hasConfig: boolean): Workflow {
  return {
    isDefault: !data.default_workflow,
    isDisabled: data.is_workflow_required !== false,
    packageHandle: parsePackageHandle(data.package_handle),
    slug: hasConfig ? notSelected : notAvailable,
  }
}

const COPY_DATA_DEFAULT = true

export const emptyConfig: WorkflowsConfig = {
  isWorkflowRequired: false,
  packageHandle: defaultPackageHandle,
  successors: [],
  workflows: [getNoWorkflow({} as WorkflowsYaml, false)],
}

function parseSchema(
  schemaSlug: string | undefined,
  schemas: Record<string, Schema> | undefined,
): Schema | undefined {
  return schemaSlug && schemas && schemaSlug in schemas
    ? {
        url: R.path([schemaSlug, 'url'], schemas) as string,
      }
    : undefined
}

function parseWorkflow(
  workflowSlug: string,
  workflow: WorkflowYaml,
  data: WorkflowsYaml,
): Workflow {
  return {
    description: workflow.description,
    isDefault: workflowSlug === data.default_workflow,
    isDisabled: false,
    name: workflow.name,
    packageHandle: parsePackageHandle(data.package_handle, workflow.package_handle),
    schema: parseSchema(workflow.metadata_schema, data.schemas),
    slug: workflowSlug,
  }
}

const parseSuccessor = (url: string, successor: SuccessorYaml): Successor => ({
  copyData: successor.copy_data === undefined ? COPY_DATA_DEFAULT : successor.copy_data,
  name: successor.title,
  slug: s3paths.parseS3Url(url).bucket,
  url,
})

const workflowsConfigValidator = makeSchemaValidator(workflowsConfigSchema)

function validateConfig(data: unknown): asserts data is WorkflowsYaml {
  const errors = workflowsConfigValidator(data)
  if (errors.length) throw new bucketErrors.WorkflowsConfigInvalid({ errors })
}

export function parse(workflowsYaml: string): WorkflowsConfig {
  const data = yaml(workflowsYaml)
  if (!data) return emptyConfig

  validateConfig(data)

  const { workflows } = data
  const workflowsList = Object.keys(workflows).map((slug) =>
    parseWorkflow(slug, workflows[slug], data),
  )

  const noWorkflow = getNoWorkflow(data, true)

  const successors = data.successors || {}
  return {
    isWorkflowRequired: data.is_workflow_required !== false,
    packageHandle: parsePackageHandle(data.package_handle),
    successors: Object.entries(successors).map(([url, successor]) =>
      parseSuccessor(url, successor),
    ),
    workflows: [noWorkflow, ...workflowsList],
  }
}
