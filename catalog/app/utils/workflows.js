import * as R from 'ramda'

import yaml from 'utils/yaml'

export const notAvaliable = Symbol('not available')

export const notSelected = Symbol('not selected')

function getNoWorkflow(data, hasConfig) {
  return {
    isDefault: !data.default_workflow,
    slug: hasConfig ? notSelected : notAvaliable,
  }
}

export const emptyConfig = {
  isRequired: false,
  workflows: [getNoWorkflow({}, false)],
}

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

export function parse(workflowsYaml) {
  const data = yaml(workflowsYaml)
  if (!data) return emptyConfig

  const { workflows } = data
  if (!workflows) return emptyConfig

  const workflowsList = Object.keys(workflows).map((slug) =>
    parseWorkflow(slug, workflows[slug], data),
  )
  if (!workflowsList.length) return emptyConfig

  const noWorkflow =
    data.is_workflow_required === false ? getNoWorkflow(data, true) : null

  return {
    isRequired: data.is_workflow_required,
    workflows: noWorkflow ? [noWorkflow, ...workflowsList] : workflowsList,
  }
}
