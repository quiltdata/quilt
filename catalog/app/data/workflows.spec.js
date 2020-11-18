import parseWorkflows, {
  emptyWorkflowsConfig,
  workflowNotAvaliable,
  workflowNotSelected,
} from './workflows'

describe('Workflows config', () => {
  it('empty file', () => {
    const config = parseWorkflows('')
    expect(config).toBe(emptyWorkflowsConfig)
    expect(config.workflows[0].slug).toBe(workflowNotAvaliable)
  })

  it('no workflows', () => {
    const data = `
version: "1"
`
    const config = parseWorkflows(data)
    expect(config).toBe(emptyWorkflowsConfig)
    expect(config.workflows[0].slug).toBe(workflowNotAvaliable)
  })

  it('empty workflows list', () => {
    const data = `
version: "1"
workflows: []
`
    expect(parseWorkflows(data)).toBe(emptyWorkflowsConfig)
  })

  it('workflow is required', () => {
    const data = `
version: "1"
is_workflow_required: True
workflows:
  workflow_1:
    name: Workflow №1
`
    const config = parseWorkflows(data)
    expect(config.workflows).toHaveLength(1)
    expect(config.workflows[0].slug).toBe('workflow_1')
  })

  it('workflow is not required explicitly', () => {
    const data = `
version: "1"
is_workflow_required: False
workflows:
  workflow_1:
    name: Workflow №1
`
    const config = parseWorkflows(data)
    expect(config.workflows).toHaveLength(2)
    expect(config.workflows[0].slug).toBe(workflowNotSelected)
    expect(config.workflows[1].slug).toBe('workflow_1')
  })

  it('workflow is required by default', () => {
    const data = `
version: "1"
workflows:
  workflow_1:
    name: Workflow №1
`
    const config = parseWorkflows(data)
    expect(config.workflows).toHaveLength(1)
    expect(config.workflows[0].slug).toBe('workflow_1')
  })

  it('get Schema url', () => {
    const data = `
version: "1"
workflows:
  workflow_1:
    name: Workflow №1
    metadata_schema: schema_1
  workflow_2:
    name: Workflow №2
    metadata_schema: schema_2
schemas:
  schema_1:
    url: https://foo
  schema_2:
    url: https://bar
`
    const config = parseWorkflows(data)
    expect(config.workflows[0].schema.url).toBe('https://foo')
    expect(config.workflows[1].schema.url).toBe('https://bar')
  })

  it('find default workflow', () => {
    const data = `
version: "1"
default_workflow: workflow_2
workflows:
  workflow_1:
    name: Workflow №1
  workflow_2:
    name: Workflow №2
  workflow_3:
    name: Workflow №3
`
    const config = parseWorkflows(data)
    expect(config.workflows[0].isDefault).toBe(false)
    expect(config.workflows[1].isDefault).toBe(true)
    expect(config.workflows[2].isDefault).toBe(false)
  })
})
