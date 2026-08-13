import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as workflows from 'utils/workflows'

import * as ERRORS from '../../errors'

import { useParams, FormInputs, Invalid, Ok } from './params'
import * as Schema from './schema'
import * as Meta from './meta'

vi.mock('constants/config', () => ({ default: {} }))

// A ready manifest is also what a dialog with no source package to load reports, so the
// defaults below describe plain package creation.
const MANIFEST_READY = { _tag: 'ready' as const }

describe('containers/Bucket/PackageDialog/State/params', () => {
  const onChange = vi.fn()
  const resetDirty = vi.fn()

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

  const useParamsWith = (overrides: Partial<FormInputs> = {}) =>
    useParams({
      dst,
      manifest: MANIFEST_READY,
      message,
      meta,
      metadataSchema: Schema.Ready({}),
      name,
      workflow,
      ...overrides,
    })

  describe('valid params', () => {
    it('should return valid params when all inputs are valid', () => {
      const { result } = renderHook(() => useParamsWith())

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

      const { result } = renderHook(() => useParamsWith({ meta: emptyMeta }))

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
        useParamsWith({
          metadataSchema: Schema.Ready(schemaWithDefaults),
          meta: partialMeta,
        }),
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
        useParamsWith({ workflow: workflowNotAvailable }),
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
        useParamsWith({ workflow: workflowNotSelected }),
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

      const { result } = renderHook(() => useParamsWith({ workflow: invalidWorkflow }))

      expect(result.current).toEqual(Invalid(new Error('Valid workflow required')))
    })

    it('should return invalid when workflow status is error', () => {
      const workflowError = {
        value: { slug: 'test-workflow' } as workflows.Workflow,
        status: { _tag: 'error' as const, error: new Error('Workflow error') },
        onChange,
      }

      const { result } = renderHook(() => useParamsWith({ workflow: workflowError }))

      expect(result.current).toEqual(Invalid(new Error('Valid workflow required')))
    })

    it('should return invalid when name value is missing', () => {
      const invalidName = {
        value: undefined,
        status: { _tag: 'error' as const, error: new Error('Name required') },
        onChange,
        resetDirty,
      }

      const { result } = renderHook(() => useParamsWith({ name: invalidName }))

      expect(result.current).toEqual(Invalid(new Error('Valid name required')))
    })

    it('should return invalid when name status is error', () => {
      const nameError = {
        value: 'test-name',
        status: { _tag: 'error' as const, error: new Error('Name error') },
        onChange,
        resetDirty,
      }

      const { result } = renderHook(() => useParamsWith({ name: nameError }))

      expect(result.current).toEqual(Invalid(new Error('Valid name required')))
    })

    it('should return invalid when message value is missing', () => {
      const invalidMessage = {
        value: undefined,
        status: { _tag: 'error' as const, error: new Error('Message required') },
        onChange,
      }

      const { result } = renderHook(() => useParamsWith({ message: invalidMessage }))

      expect(result.current).toEqual(Invalid(new Error('Valid message required')))
    })

    it('should return invalid when message status is error', () => {
      const messageError = {
        value: 'test message',
        status: { _tag: 'error' as const, error: new Error('Message error') },
        onChange,
      }

      const { result } = renderHook(() => useParamsWith({ message: messageError }))

      expect(result.current).toEqual(Invalid(new Error('Valid message required')))
    })

    it('should return invalid when metadataSchema is not ready', () => {
      const { result } = renderHook(() => useParamsWith({ metadataSchema: Schema.Idle }))

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

      const { result } = renderHook(() => useParamsWith({ meta: metaError }))

      expect(result.current).toEqual(Invalid(new Error('Metadata must be valid')))
    })
  })

  describe('unloaded source manifest', () => {
    const manifestError = { _tag: 'error' as const, error: new Error('failed to fetch') }
    // A workflow is set throughout: its prefill needs a ready manifest, and choosing one
    // by hand is what defeated that accidental guard and reached the destructive push.
    const existingName = { ...name, status: { _tag: 'new-revision' as const } }

    it.each([
      ['error', manifestError],
      ['loading', { _tag: 'loading' as const }],
      ['idle', { _tag: 'idle' as const }],
    ])('is invalid when the manifest is %s and the package exists', (_tag, manifest) => {
      const { result } = renderHook(() => useParamsWith({ name: existingName, manifest }))

      expect(result.current._tag).toBe('invalid')
      if (result.current._tag === 'invalid') {
        // Typed so the dialog can tell this apart from a stale submission error.
        expect(result.current.error).toBeInstanceOf(ERRORS.SourceManifestNotLoaded)
      }
    })

    it('reports the manifest as the blocker even before a workflow is chosen', () => {
      // A failed manifest also blocks the workflow prefill, so reporting a missing
      // workflow instead would let the dialog call the destination safe to push over.
      const { result } = renderHook(() =>
        useParamsWith({
          manifest: manifestError,
          name: existingName,
          workflow: { value: undefined, status: { _tag: 'ok' as const }, onChange },
        }),
      )

      expect(result.current._tag).toBe('invalid')
      if (result.current._tag === 'invalid') {
        expect(result.current.error).toBeInstanceOf(ERRORS.SourceManifestNotLoaded)
      }
    })

    it('stays valid for a destination that does not exist yet', () => {
      // Nothing to overwrite, so the staged files can still be pushed as a new package.
      const { result } = renderHook(() => useParamsWith({ manifest: manifestError }))

      expect(result.current._tag).toBe('ok')
    })

    it.each([
      ['new-revision', { _tag: 'new-revision' as const }],
      ['exists', { _tag: 'exists' as const, dst: { bucket: 'b', name: 'n' } }],
    ])('stays valid for an existing destination once loaded (%s)', (_tag, status) => {
      // The path the gate must not block: revising a package whose manifest did load.
      // Without it, a gate that refuses everything but brand-new names passes the suite.
      const { result } = renderHook(() =>
        useParamsWith({ manifest: MANIFEST_READY, name: { ...name, status } }),
      )

      expect(result.current._tag).toBe('ok')
    })
  })

  describe('memoization', () => {
    it('should recompute when dependencies change', () => {
      const { result, rerender } = renderHook(
        (params) => useParamsWith({ name: { ...name, value: params.name } }),
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
      const { result, rerender } = renderHook(() => useParamsWith())

      const firstResult = result.current
      rerender()
      const secondResult = result.current

      expect(secondResult).toStrictEqual(firstResult)
    })
  })
})
