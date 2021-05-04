import dedent from 'dedent'

import * as workflows from 'utils/workflows'

import * as SelectWorkflow from './SelectWorkflow'

describe('containers/Bucket/PackageDialog/SelectWorkflow', () => {
  describe('getOptions', () => {
    it('should return options with disabled "None" when workflow is required', () => {
      const config = dedent`
        version: "1"
        is_workflow_required: True
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const uiOptions = SelectWorkflow.getOptions(workflows.parse(config).workflows)
      expect(uiOptions).toMatchObject([
        {
          disabled: true,
          key: 'Symbol(not selected)',
          label: 'None',
        },
        {
          key: 'workflow_1',
          label: 'Workflow №1',
        },
      ])
    })

    it('should return options with "None" enabled when workflow is not required', () => {
      const config = dedent`
        version: "1"
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const uiOptions = SelectWorkflow.getOptions(workflows.parse(config).workflows)
      expect(uiOptions).toMatchObject([
        {
          key: 'Symbol(not selected)',
          label: 'None',
        },
        {
          key: 'workflow_1',
          label: 'Workflow №1',
        },
      ])
    })
  })
})
