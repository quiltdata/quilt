import * as R from 'ramda'

import yaml from 'utils/yaml'

/* TODO:
   ```
   class Workflows {
     static parse(rawData) {
      return new Workflows(parsedData)
     }

     static nil() { // instead of emptyWorkflowsConfig
      return new Workflows()
     }
   }
   ```
*/

export const workflowNotAvaliable = Symbol('not available')

export const workflowNotSelected = Symbol('not selected')

function getNoWorkflow(data, hasConfig) {
  return {
    isDefault: !data.default_workflow,
    slug: hasConfig ? workflowNotSelected : workflowNotAvaliable,
  }
}

export const emptyWorkflowsConfig = {
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

export default function parseWorkflows(workflowsYaml) {
  const data = yaml(workflowsYaml)
  if (!data) return emptyWorkflowsConfig

  const { workflows } = data
  if (!workflows) return emptyWorkflowsConfig

  const workflowsList = Object.keys(workflows).map((slug) =>
    parseWorkflow(slug, workflows[slug], data),
  )
  if (!workflowsList.length) return emptyWorkflowsConfig

  const noWorkflow =
    data.is_workflow_required === false ? getNoWorkflow(data, true) : null

  return {
    isRequired: data.is_workflow_required,
    workflows: noWorkflow ? [noWorkflow, ...workflowsList] : workflowsList,
  }
}
