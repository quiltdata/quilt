import * as R from 'ramda'

import { makeSchemaValidator } from 'utils/json-schema'
import * as s3paths from 'utils/s3paths'
import yaml from 'utils/yaml'

import workflowsConfigSchema from 'utils/workflows.schema.json'

export const notAvaliable = Symbol('not available')

export const notSelected = Symbol('not selected')

function getNoWorkflow(data, hasConfig) {
  return {
    isDefault: !data.default_workflow,
    slug: hasConfig ? notSelected : notAvaliable,
  }
}

const COPY_DATA_DEFAULT = true

export const emptyConfig = {
  successors: [],
  workflows: [getNoWorkflow({}, false)],
}

export const getEmptyConfig = (errors) => ({
  ...emptyConfig,
  errors,
})

function parseSchema(schemaSlug, schemas) {
  return {
    url: R.path([schemaSlug, 'url'], schemas),
  }
}

function parseWorkflow(workflowSlug, workflow, data) {
  return {
    description: workflow.description,
    isDefault: workflowSlug === data.default_workflow,
    name: workflow.name,
    schema: parseSchema(workflow.metadata_schema, data.schemas),
    slug: workflowSlug,
  }
}

const parseSuccessor = (url, successor) => ({
  copyData: successor.copy_data === undefined ? COPY_DATA_DEFAULT : successor.copy_data,
  name: successor.title,
  slug: s3paths.parseS3Url(url).bucket,
  url,
})

const workflowsConfigValidator = makeSchemaValidator(workflowsConfigSchema)

export function parse(workflowsYaml) {
  const data = yaml(workflowsYaml)
  if (!data) return emptyConfig

  const errors = workflowsConfigValidator(data)
  if (errors.length) return getEmptyConfig(errors)

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
    workflows: noWorkflow ? [noWorkflow, ...workflowsList] : workflowsList,
  }
}
