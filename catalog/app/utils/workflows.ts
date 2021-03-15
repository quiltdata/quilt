import * as R from 'ramda'

import { makeSchemaValidator } from 'utils/json-schema'
import * as s3paths from 'utils/s3paths'
import yaml from 'utils/yaml'
import workflowsConfigSchema from 'schemas/workflows.yml.json'
import * as bucketErrors from 'containers/Bucket/errors'

interface UiYaml {
  nav?: Record<'overview' | 'files' | 'packages' | 'queries', boolean>
}

interface WorkflowsYaml {
  version: '1'
  is_workflow_required?: boolean
  default_workflow?: string
  workflows: Record<string, WorkflowYaml>
  schemas?: Record<string, Schema>
  successors?: Record<string, SuccessorYaml>
  ui?: UiYaml
}

interface WorkflowYaml {
  name: string
  description?: string
  metadata_schema?: string
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

interface UiPreferences {
  nav: {
    files: boolean
    overview: boolean
    packages: boolean
    queries: boolean
  }
}

export interface Schema {
  url: string
}

export interface Workflow {
  name?: string
  slug: string | typeof notAvaliable | typeof notSelected
  isDefault: boolean
  description?: string
  schema?: Schema
}

export interface WorkflowsConfig {
  successors: Successor[]
  ui: UiPreferences
  workflows: Workflow[]
}

export const notAvaliable = Symbol('not available')

export const notSelected = Symbol('not selected')

function getNoWorkflow(data: WorkflowsYaml, hasConfig: boolean): Workflow {
  return {
    isDefault: !data.default_workflow,
    slug: hasConfig ? notSelected : notAvaliable,
  }
}

const COPY_DATA_DEFAULT = true

export const emptyConfig: WorkflowsConfig = {
  successors: [],
  workflows: [getNoWorkflow({} as WorkflowsYaml, false)],
  ui: {
    nav: {
      files: false,
      overview: true,
      packages: true,
      queries: true,
    },
  },
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
    schema: parseSchema(workflow.metadata_schema, data.schemas),
    slug: workflowSlug,
  }
}

function parseUi(ui: UiYaml): UiPreferences {
  return {
    nav: R.mergeRight(emptyConfig.ui.nav, ui.nav || {}),
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
    successors: Object.entries(successors).map(([url, successor]) =>
      parseSuccessor(url, successor),
    ),
    ui: parseUi(data.ui || {}),
    workflows: noWorkflow ? [noWorkflow, ...workflowsList] : workflowsList,
  }
}
