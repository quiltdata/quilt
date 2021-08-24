import * as R from 'ramda'

import { makeSchemaValidator } from 'utils/json-schema'
import type * as packageHandleUtils from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import yaml from 'utils/yaml'
import workflowsConfigSchema from 'schemas/workflows.yml.json'
import * as bucketErrors from 'containers/Bucket/errors'

interface WorkflowsYaml {
  version: '1'
  is_workflow_required?: boolean
  default_workflow?: string
  package_handle?: packageHandleUtils.NameTemplates
  workflows: Record<string, WorkflowYaml>
  schemas?: Record<string, Schema>
  successors?: Record<string, SuccessorYaml>
}

interface WorkflowYaml {
  name: string
  description?: string
  metadata_schema?: string
  package_handle?: packageHandleUtils.NameTemplates
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
  packageName: Required<packageHandleUtils.NameTemplates>
  schema?: Schema
  slug: string | typeof notAvailable | typeof notSelected
}

export interface WorkflowsConfig {
  isWorkflowRequired: boolean
  packageName: Required<packageHandleUtils.NameTemplates>
  successors: Successor[]
  workflows: Workflow[]
}

const defaultPackageNameTemplates = {
  files: '',
  packages: '',
}

export const notAvailable = Symbol('not available')

const parsePackageNameTemplates = (
  globalTemplates?: packageHandleUtils.NameTemplates,
  workflowTemplates?: packageHandleUtils.NameTemplates,
): Required<packageHandleUtils.NameTemplates> => ({
  ...defaultPackageNameTemplates,
  ...globalTemplates,
  ...workflowTemplates,
})

export const notSelected = Symbol('not selected')

function getNoWorkflow(data: WorkflowsYaml, hasConfig: boolean): Workflow {
  return {
    isDefault: !data.default_workflow,
    isDisabled: data.is_workflow_required !== false,
    packageName: parsePackageNameTemplates(data.package_handle),
    slug: hasConfig ? notSelected : notAvailable,
  }
}

const COPY_DATA_DEFAULT = true

export const emptyConfig: WorkflowsConfig = {
  isWorkflowRequired: false,
  packageName: defaultPackageNameTemplates,
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
    packageName: parsePackageNameTemplates(data.package_handle, workflow.package_handle),
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
    packageName: parsePackageNameTemplates(data.package_handle),
    successors: Object.entries(successors).map(([url, successor]) =>
      parseSuccessor(url, successor),
    ),
    workflows: [noWorkflow, ...workflowsList],
  }
}
