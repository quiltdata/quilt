import { renderHook } from '@testing-library/react-hooks'

import * as workflows from 'utils/workflows'

import { useParams, Invalid, Ok } from './params'
import * as Schema from './schema'
import * as Meta from './meta'

jest.mock('constants/config', () => ({}))

describe('containers/Bucket/PackageDialog/State/params', () => {
  const onChange = jest.fn()
  const resetDirty = jest.fn()

  const dst = { bucket: 'test-bucket', name: 'test-package' }

  const workflow = {
    value: { slug: 'test-workflow' } as workflows.Workflow,
    status: { _tag: 'ok' as const },
    onChange,
  }

  const name = {
    value: 'test-package',
    status: { _tag: 'new' as const },
    onChange,
    resetDirty,
  }

  const message = {
    value: 'Test commit message',
    status: { _tag: 'ok' as const },
    onChange,
  }

  const meta = {
    value: { title: 'Test Package' },
    status: Meta.Ok,
    onChange,
  }

  describe('valid params', () => {
    it('should return valid params when all inputs are valid', () => {
      const { result } = renderHook(() =>
        useParams(dst, workflow, name, message, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(
        Ok({
          bucket: 'test-bucket',
          message: 'Test commit message',
          name: 'test-package',
          userMeta: { title: 'Test Package' },
          workflow: 'test-workflow',
        }),
      )
    })

    it('should handle null userMeta when meta value is empty', () => {
      const emptyMeta = {
        value: {},
        status: Meta.Ok,
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflow, name, message, Schema.Ready({}), emptyMeta),
      )

      expect(result.current._tag).toBe('ok')
      if (result.current._tag === 'ok') {
        expect(result.current.params.userMeta).toBeNull()
      }
    })

    it('should apply schema defaults through getMetaValue', () => {
      const schemaWithDefaults = {
        type: 'object',
        properties: {
          title: { type: 'string', default: 'Default Title' },
          version: { type: 'string', default: '1.0.0' },
        },
      }

      const partialMeta = {
        value: { title: 'Custom Title' },
        status: Meta.Ok,
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(
          dst,
          workflow,
          name,
          message,
          Schema.Ready(schemaWithDefaults),
          partialMeta,
        ),
      )

      expect(result.current._tag).toBe('ok')
      if (result.current._tag === 'ok') {
        expect(result.current.params.userMeta).toEqual({
          title: 'Custom Title',
          version: '1.0.0', // Default from schema
        })
      }
    })

    it('should handle workflow notAvailable as null', () => {
      const workflowNotAvailable = {
        value: { slug: workflows.notAvailable } as workflows.Workflow,
        status: { _tag: 'ok' as const },
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflowNotAvailable, name, message, Schema.Ready({}), meta),
      )

      expect(result.current._tag).toBe('ok')
      if (result.current._tag === 'ok') {
        expect(result.current.params.workflow).toBeNull()
      }
    })

    it('should handle workflow notSelected as empty string', () => {
      const workflowNotSelected = {
        value: { slug: workflows.notSelected } as workflows.Workflow,
        status: { _tag: 'ok' as const },
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflowNotSelected, name, message, Schema.Ready({}), meta),
      )

      expect(result.current._tag).toBe('ok')
      if (result.current._tag === 'ok') {
        expect(result.current.params.workflow).toBe('')
      }
    })
  })

  describe('validation failures', () => {
    it('should return invalid when workflow value is missing', () => {
      const invalidWorkflow = {
        value: undefined,
        status: { _tag: 'ok' as const },
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, invalidWorkflow, name, message, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(Invalid(new Error('Valid workflow required')))
    })

    it('should return invalid when workflow status is error', () => {
      const workflowError = {
        value: { slug: 'test-workflow' } as workflows.Workflow,
        status: { _tag: 'error' as const, error: new Error('Workflow error') },
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflowError, name, message, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(Invalid(new Error('Valid workflow required')))
    })

    it('should return invalid when name value is missing', () => {
      const invalidName = {
        value: undefined,
        status: { _tag: 'error' as const, error: new Error('Name required') },
        onChange,
        resetDirty,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflow, invalidName, message, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(Invalid(new Error('Valid name required')))
    })

    it('should return invalid when name status is error', () => {
      const nameError = {
        value: 'test-name',
        status: { _tag: 'error' as const, error: new Error('Name error') },
        onChange,
        resetDirty,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflow, nameError, message, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(Invalid(new Error('Valid name required')))
    })

    it('should return invalid when message value is missing', () => {
      const invalidMessage = {
        value: undefined,
        status: { _tag: 'error' as const, error: new Error('Message required') },
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflow, name, invalidMessage, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(Invalid(new Error('Valid message required')))
    })

    it('should return invalid when message status is error', () => {
      const messageError = {
        value: 'test message',
        status: { _tag: 'error' as const, error: new Error('Message error') },
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflow, name, messageError, Schema.Ready({}), meta),
      )

      expect(result.current).toEqual(Invalid(new Error('Valid message required')))
    })

    it('should return invalid when metadataSchema is not ready', () => {
      const { result } = renderHook(() =>
        useParams(dst, workflow, name, message, Schema.Idle, meta),
      )

      expect(result.current).toEqual(
        Invalid(new Error('Metadata JSON Schema is not ready')),
      )
    })

    it('should return invalid when meta status is error', () => {
      const metaError = {
        value: { title: 'Test' },
        status: Meta.Err(new Error('Meta validation error')),
        onChange,
      }

      const { result } = renderHook(() =>
        useParams(dst, workflow, name, message, Schema.Ready({}), metaError),
      )

      expect(result.current).toEqual(Invalid(new Error('Metadata must be valid')))
    })
  })

  describe('memoization', () => {
    it('should recompute when dependencies change', () => {
      const { result, rerender } = renderHook(
        (params) =>
          useParams(
            dst,
            workflow,
            { ...name, value: params.name },
            message,
            Schema.Ready({}),
            meta,
          ),
        { initialProps: { name: 'name1' } },
      )

      const firstResult = result.current
      expect(firstResult._tag).toBe('ok')
      if (firstResult._tag === 'ok') {
        expect(firstResult.params.name).toBe('name1')
      }

      rerender({ name: 'name2' })

      const secondResult = result.current
      expect(secondResult._tag).toBe('ok')
      if (secondResult._tag === 'ok') {
        expect(secondResult.params.name).toBe('name2')
      }
      expect(secondResult).not.toBe(firstResult)
    })

    it('should return consistent results when dependencies stay the same', () => {
      const { result, rerender } = renderHook(() =>
        useParams(dst, workflow, name, message, Schema.Ready({}), meta),
      )

      const firstResult = result.current
      rerender()
      const secondResult = result.current

      expect(secondResult).toStrictEqual(firstResult)
    })
  })
})
