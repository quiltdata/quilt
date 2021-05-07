import * as R from 'ramda'

import { makeSchemaValidator } from 'utils/json-schema'
import * as s3paths from 'utils/s3paths'
import yaml from 'utils/yaml'
import * as packageHandle from 'utils/packageHandle'
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

export interface NavPreferences {
  files: boolean
  overview: boolean
  packages: boolean
  queries: boolean
}

export interface Schema {
  url: string
}

export interface Workflow {
  name?: string
  slug: string | typeof notAvailable | typeof notSelected
  isDefault: boolean
  description?: string
  packageHandle: Required<packageHandle.Handles>
  schema?: Schema
}

export interface WorkflowsConfig {
  packageHandle: Required<packageHandle.Handles>
  successors: Successor[]
  workflows: Workflow[]
}

export const notAvailable = Symbol('not available')

export const notSelected = Symbol('not selected')

const parsePackageHandle = (
  globalHandle?: packageHandle.Handles,
  workflowHandle?: packageHandle.Handles,
): Required<packageHandle.Handles> => ({
  ...defaultPackageHandle,
  ...globalHandle,
  ...workflowHandle,
})

const getNoWorkflow = (data: WorkflowsYaml, hasConfig: boolean): Workflow => ({
  isDefault: !data.default_workflow,
  packageHandle: parsePackageHandle(data.package_handle),
  slug: hasConfig ? notSelected : notAvailable,
})

const COPY_DATA_DEFAULT = true

const defaultPackageHandle = {
  files: '',
  packages: '',
}

export const emptyConfig: WorkflowsConfig = {
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

  const noWorkflow =
    data.is_workflow_required === false ? getNoWorkflow(data, true) : null

  const successors = data.successors || {}
  return {
    packageHandle: parsePackageHandle(data.package_handle),
    successors: Object.entries(successors).map(([url, successor]) =>
      parseSuccessor(url, successor),
    ),
    workflows: noWorkflow ? [noWorkflow, ...workflowsList] : workflowsList,
  }
}
