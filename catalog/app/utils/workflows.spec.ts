import { describe, it, expect } from 'vitest'
import dedent from 'dedent'

import * as errors from 'containers/Bucket/errors'
import * as workflows from './workflows'

describe('utils/workflows', () => {
  describe('parse', () => {
    describe('no config input', () => {
      const config = workflows.parse('', 'foo')

      it('should return default empty values', () => {
        expect(config).toEqual(workflows.emptyConfig('foo'))
      })

      it('should return data with special `notAvailable` workflow', () => {
        expect(config.workflows[0].isDisabled).toBe(true)
        expect(config.workflows[0].slug).toBe(workflows.notAvailable)
      })
    })

    describe('config without `workflows` (invalid config)', () => {
      const data = dedent`
        version: "1"
      `
      it('should throw errors.WorkflowsConfigInvalid', () => {
        expect(() => workflows.parse(data, 'foo')).toThrow(errors.WorkflowsConfigInvalid)
      })
    })

    describe('config with empty list as `workflows` (invalid config)', () => {
      const data = dedent`
        version: "1"
        workflows: []
      `
      it('should throw errors.WorkflowsConfigInvalid', () => {
        expect(() => workflows.parse(data, 'foo')).toThrow(errors.WorkflowsConfigInvalid)
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
      const config = workflows.parse(data, 'foo')

      it('should require workflow', () => {
        expect(config.isWorkflowRequired).toBe(true)
      })

      it('should return workflows list', () => {
        expect(config.workflows).toHaveLength(2)
      })

      it('should return `notSelected` workflow as disabled', () => {
        expect(config.workflows[0].slug).toBe(workflows.notSelected)
        expect(config.workflows[0].isDisabled).toBe(true)
      })

      it('should return workflow with exact key/slug', () => {
        expect(config.workflows[1].slug).toBe('workflow_1')
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
      const config = workflows.parse(data, 'foo')

      it('should not require workflow', () => {
        expect(config.isWorkflowRequired).toBe(false)
      })

      it('should return two workflows', () => {
        expect(config.workflows).toHaveLength(2)
      })

      it('should return first workflow as special `notSelected` workflow', () => {
        expect(config.workflows[0].slug).toBe(workflows.notSelected)
        expect(config.workflows[0].isDisabled).toBe(false)
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
      const config = workflows.parse(data, 'foo')

      it('should require workflow', () => {
        expect(config.isWorkflowRequired).toBe(true)
      })

      it('should return one workflow', () => {
        expect(config.workflows).toHaveLength(2)
      })

      it('should return `notSelected` workflow as disabled', () => {
        expect(config.workflows[0].slug).toBe(workflows.notSelected)
        expect(config.workflows[0].isDisabled).toBe(true)
      })

      it('should return workflow with exact key/slug from config', () => {
        expect(config.workflows[1].slug).toBe('workflow_1')
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
      const config = workflows.parse(data, 'foo')

      it('should return workflow with matched url', () => {
        expect(config.workflows[1].schema!.url).toBe('https://foo')
        expect(config.workflows[2].schema!.url).toBe('https://bar')
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
      const config = workflows.parse(data, 'foo')

      it("should return workflows' list, one of which is default", () => {
        expect(config.workflows).toMatchObject([
          { isDefault: false },
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
      const config = workflows.parse(data, 'foo')

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
      const config = workflows.parse(data, 'foo')

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
            copyData: true,
          },
        ])
      })
    })

    describe('strict mode', () => {
      it('should return nullConfig when no config input and strict is true', () => {
        const config = workflows.parse('', 'foo', { strict: true })
        expect(config).toEqual(workflows.nullConfig)
      })

      it('should return emptyConfig when no config input and strict is false', () => {
        const config = workflows.parse('', 'foo', { strict: false })
        expect(config).toEqual(workflows.emptyConfig('foo'))
      })
    })
  })
  describe('handle_pattern the browser cannot compile', () => {
    const data = dedent`
      version: "1"
      workflows:
        a:
          name: A
          handle_pattern: "^(?P<lab>[a-z]+)/(?P=lab)$"
    `
    it('keeps the config usable and records why the pattern is skipped', () => {
      const w = workflows.parse(data, 'foo').workflows[1]
      expect(w.packageNamePattern).toBe(null)
      expect(w.packageNamePatternError).toMatch('(?P=')
    })
  })
  describe('Python-only anchors', () => {
    it('are skipped rather than read as literal letters', () => {
      const w = workflows.parse(
        'version: "1"\nworkflows:\n  a:\n    name: A\n    handle_pattern: "^[a-z]+/[a-z]+\\\\Z"\n',
        'foo',
      ).workflows[1]
      expect(w.packageNamePattern).toBe(null)
      expect(w.packageNamePatternError).toMatch('\\Z')
    })
  })

  describe('handle_pattern with Python character classes', () => {
    const pattern = (p: string) =>
      workflows.parse(
        `version: "1"\nworkflows:\n  a:\n    name: A\n    handle_pattern: '${p}'\n`,
        'foo',
      ).workflows[1]

    it('matches Unicode names the way push does', () => {
      const w = pattern('^\\w+/[\\w-]+\\d$')
      expect(w.packageNamePattern?.test('lab/é-x1')).toBe(true)
      expect(w.packageNamePattern?.test('lab/x!1')).toBe(false)
    })

    it('skips word boundaries, which JS keeps ASCII-only', () => {
      expect(pattern('^lab/\\b').packageNamePatternError).toMatch('\\b')
    })
  })

  describe('workflow naming a schema the config does not define', () => {
    const data = dedent`
      version: "1"
      workflows:
        a:
          name: A
          metadata_schema: missing
    `
    it('reports it, since push rejects that workflow', () => {
      expect(workflows.parse(data, 'foo').workflows[1].undefinedSchemas).toEqual([
        'missing',
      ])
    })
  })
  describe('config that is not valid YAML', () => {
    it('is reported, not read as an empty bucket', () => {
      expect(() =>
        workflows.parse('version: "1"\nworkflows:\n  a: {name: A\n', 'foo'),
      ).toThrow(errors.WorkflowsConfigInvalid)
    })
  })
  describe('Python pattern translation', () => {
    const pattern = (p: string) =>
      workflows.parse(
        `version: "1"\nworkflows:\n  a:\n    name: A\n    handle_pattern: '${p}'\n`,
        'foo',
      ).workflows[1]

    it('keeps identity escapes working alongside Unicode classes', () => {
      const w = pattern('^lab\\-\\w+/')
      expect(w.packageNamePatternError).toBeUndefined()
      expect(w.packageNamePattern?.test('lab-é/x')).toBe(true)
      expect(w.handlePattern).toBe('^lab\\-\\w+/')
    })

    it('treats a leading ] in a negated class as a literal', () => {
      const w = pattern('^[^]]\\w/')
      expect(w.packageNamePattern?.test('aé/')).toBe(true)
      expect(w.packageNamePattern?.test(']é/')).toBe(false)
    })
  })
  describe('analyzePattern', () => {
    const tag = (p: string) => workflows.analyzePattern(p)._tag
    const ok = (p: string, yes: string, no: string) => {
      const a = workflows.analyzePattern(p)
      if (a._tag !== 'ok') throw new Error(`${p}: ${a._tag}`)
      expect(a.regex.test(yes)).toBe(true)
      expect(a.regex.test(no)).toBe(false)
    }

    it('translates Python syntax that has an exact JS equivalent', () => {
      ok('^(?P<lab>[a-z]+)/', 'abc/x', '1/x')
      ok('^lab\\–x', 'lab–x', 'labux')
      ok('(?#team prefix)^lab/', 'lab/x', 'x/lab')
      ok('^lab\\😀', 'lab😀', 'lab')
    })

    it('leaves valid Python it cannot reproduce to the push', () => {
      expect(tag('(?>a)b')).toBe('uncheckable')
      expect(tag('a*+b')).toBe('uncheckable')
      expect(tag('(?x) ^lab/ # (team prefix')).toBe('uncheckable')
      expect(tag('\\A\\d+\\Z')).toBe('uncheckable')
    })

    it('matches Python on repeats and braces', () => {
      for (const p of ['*.csv', 'a**', '^*', 'a|*', 'a?*', 'a{3}{2}', 'a{3,2}']) {
        expect([p, tag(p)]).toEqual([p, 'invalid'])
      }
      ok('^{lab}/', '{lab}/x', 'lab/x')
      ok('^a{,2}$', 'aa', 'aaa')
      ok('^x{$', 'x{', 'x')
      ok('^a{}$', 'a{}', 'a')
      ok('^a??b', 'b', 'c')
    })

    it('rejects JS-style named groups and unknown groups, like Python', () => {
      expect(tag('^(?<team>lab)/')).toBe('invalid')
      expect(tag('(?Q)')).toBe('invalid')
      expect(tag('(?<=ab|c)x')).toBe('uncheckable')
    })

    it('rejects what Python would reject', () => {
      expect(tag('^\\p{L}+/')).toBe('invalid')
      expect(tag('(')).toBe('invalid')
      expect(tag('a)')).toBe('invalid')
      expect(tag('[ab')).toBe('invalid')
    })
  })
})
