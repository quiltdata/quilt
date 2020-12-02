import dedent from 'dedent'

import * as workflows from './workflows'

describe('utils/workflows', () => {
  describe('parse', () => {
    describe('no config input', () => {
      const config = workflows.parse('')

      it('should return default empty values', () => {
        expect(config).toEqual(workflows.emptyConfig)
      })

      it('should return data with special `notAvailable` workflow', () => {
        expect(config.workflows[0].slug).toBe(workflows.notAvaliable)
      })
    })

    describe('config without `workflows` (invalid config)', () => {
      const data = dedent`
        version: "1"
      `
      const config = workflows.parse(data)

      it('should return default empty values', () => {
        expect(config).toEqual(workflows.emptyConfig)
      })

      it('should return data with special `notAvailable` workflow', () => {
        expect(config.workflows[0].slug).toBe(workflows.notAvaliable)
      })
    })

    describe('config with empty list as `workflows` (invalid config)', () => {
      const data = dedent`
        version: "1"
        workflows: []
      `
      const config = workflows.parse(data)

      it('should return default empty values', () => {
        expect(config).toEqual(workflows.emptyConfig)
      })

      it('should return data with special `notAvailable` workflow', () => {
        expect(config.workflows[0].slug).toBe(workflows.notAvaliable)
      })
    })

    describe('config with required workflow', () => {
      const data = dedent`
        version: "1"
        is_workflow_required: True
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const config = workflows.parse(data)

      it('should return workflows list', () => {
        expect(config.workflows).toHaveLength(1)
      })

      it('should return workflow with exact key/slug', () => {
        expect(config.workflows[0].slug).toBe('workflow_1')
      })
    })

    describe('config with workflow not required explicitly', () => {
      const data = dedent`
        version: "1"
        is_workflow_required: False
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const config = workflows.parse(data)

      it('should return two workflows', () => {
        expect(config.workflows).toHaveLength(2)
      })

      it('should return first workflow as special `notSelected` workflow', () => {
        expect(config.workflows[0].slug).toBe(workflows.notSelected)
      })

      it('should return workflow with exact key/slug from config', () => {
        expect(config.workflows[1].slug).toBe('workflow_1')
      })
    })

    describe('config with workflow required implicitly', () => {
      const data = dedent`
        version: "1"
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const config = workflows.parse(data)

      it('should return one workflow', () => {
        expect(config.workflows).toHaveLength(1)
      })

      it('should return workflow with exact key/slug from config', () => {
        expect(config.workflows[0].slug).toBe('workflow_1')
      })
    })

    describe('config with Schema urls', () => {
      const data = dedent`
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
      const config = workflows.parse(data)

      it('should return workflow with matched url', () => {
        expect(config.workflows[0].schema.url).toBe('https://foo')
        expect(config.workflows[1].schema.url).toBe('https://bar')
      })
    })

    describe('config with default workflow', () => {
      const data = dedent`
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
      const config = workflows.parse(data)

      it("should return workflows' list, one of which is default", () => {
        expect(config.workflows).toMatchObject([
          { isDefault: false },
          { isDefault: true },
          { isDefault: false },
        ])
      })
    })

    describe('config with successors', () => {
      const data = dedent`
        version: "1"
        default_workflow: workflow_2
        successors:
          s3://something:
            title: Successor №1
          s3://bucket-multiworded:
            title: Multi worded bucket
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const config = workflows.parse(data)

      it('should return successors list', () => {
        expect(config.successors).toMatchObject([
          {
            name: 'Successor №1',
            slug: 'something',
            url: 's3://something',
          },
          {
            name: 'Multi worded bucket',
            slug: 'bucket-multiworded',
            url: 's3://bucket-multiworded',
          },
        ])
      })
    })

    describe('config with copy_data', () => {
      const data = dedent`
        version: "1"
        default_workflow: workflow_2
        successors:
          s3://something:
            title: Successor №1
            copy_data: True
          s3://bucket-multiworded:
            copy_data: False
            title: Multi worded bucket
          s3://bucket-copy-default:
            title: Copy default
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const config = workflows.parse(data)

      it('should return copyData params', () => {
        expect(config.successors).toMatchObject([
          {
            name: 'Successor №1',
            slug: 'something',
            url: 's3://something',
            copyData: true,
          },
          {
            name: 'Multi worded bucket',
            slug: 'bucket-multiworded',
            url: 's3://bucket-multiworded',
            copyData: false,
          },
          {
            name: 'Copy default',
            slug: 'bucket-copy-default',
            url: 's3://bucket-copy-default',
            copyData: false,
          },
        ])
      })
    })

    describe('shouldSuccessorCopyData', () => {
      const data = dedent`
        version: "1"
        default_workflow: workflow_2
        successors:
          s3://something:
            title: Successor №1
            copy_data: True
          s3://bucket-multiworded:
            copy_data: False
            title: Multi worded bucket
          s3://bucket-copy-default:
            title: Copy default
        workflows:
          workflow_1:
            name: Workflow №1
      `
      const config = workflows.parse(data)

      it('should return false by default', () => {
        expect(workflows.shouldSuccessorCopyData(config, 'fgsfds')).toBe(true)
      })

      it('should return correct value when value set', () => {
        expect(workflows.shouldSuccessorCopyData(config, 'bucket-multiworded')).toBe(
          false,
        )
      })
    })
  })
})
