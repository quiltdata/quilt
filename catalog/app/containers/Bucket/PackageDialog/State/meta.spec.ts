import { renderHook, act } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as Form from './form'
import * as Manifest from './manifest'
import { useMeta, Err, Ok } from './meta'
import * as Schema from './schema'

vi.mock('constants/config', () => ({ default: {} }))

const useFeature = vi.fn(() => false)
vi.mock('utils/features', () => ({ useFeature: () => useFeature() }))

const mkMetaValidator = vi.fn()
vi.mock('./schema', async () => ({
  ...(await vi.importActual('./schema')),
  mkMetaValidator: () => mkMetaValidator(),
}))

const SchemaReady = Schema.Ready()

describe('containers/Bucket/PackageDialog/State/meta', () => {
  describe('useMeta', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      useFeature.mockReturnValue(false)
    })

    describe('value', () => {
      it('should use fallback meta from manifest when local meta is undefined', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(
            Form.Idle,
            SchemaReady,
            Manifest.Ready({ meta: { title: 'Test Package' } }),
          ),
        )

        expect(result.current.value).toEqual({ title: 'Test Package' })
      })

      it('should prioritize local meta over manifest meta when both exist', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(
            Form.Idle,
            SchemaReady,
            Manifest.Ready({ meta: { title: 'Manifest Title' } }),
          ),
        )

        act(() => {
          result.current.onChange({ title: 'Local Title' })
        })

        expect(result.current.value).toEqual({ title: 'Local Title' })
      })

      it('should return undefined when manifest is not ready and no local meta', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Loading),
        )

        expect(result.current.value).toBeUndefined()
      })

      it('should return undefined when manifest is ready but has no meta and no local meta', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Ready({})),
        )

        expect(result.current.value).toBeUndefined()
      })
    })

    describe('status', () => {
      describe('form not in error state', () => {
        it('should return ok status when form has no errors and validation passes', () => {
          mkMetaValidator.mockReturnValue(() => undefined)

          const { result } = renderHook(() =>
            useMeta(Form.Idle, SchemaReady, Manifest.Ready()),
          )

          expect(result.current.status).toEqual(Ok)
        })

        it('should ignore validation errors when form is not in error state', () => {
          const validationError = new Error('Validation failed')
          mkMetaValidator.mockReturnValue(() => [validationError])

          const { result } = renderHook(() =>
            useMeta(Form.Idle, SchemaReady, Manifest.Ready()),
          )

          expect(result.current.status).toEqual(Ok)
        })
      })

      describe('form in error state', () => {
        it('should return error status when form has userMeta field error', () => {
          mkMetaValidator.mockReturnValue(() => undefined)

          const userMetaError = new Error('Invalid metadata format')

          const { result } = renderHook(() =>
            useMeta(
              Form.Err(new Error('Form error'), { userMeta: userMetaError }),
              SchemaReady,
              Manifest.Ready(),
            ),
          )

          expect(result.current.status).toEqual(Err(userMetaError))
        })

        it('should return error status when schema is in error state', () => {
          const schemaError = new Error('Schema loading failed')
          mkMetaValidator.mockReturnValue(() => [schemaError])

          const { result } = renderHook(() =>
            useMeta(
              Form.Err(new Error('Form error')),
              Schema.Err(schemaError),
              Manifest.Ready(),
            ),
          )

          expect(result.current.status).toEqual(Err(schemaError))
        })

        it('should return error status when schema is not ready (idle/loading)', () => {
          const notReadyError = new Error('Schema is not ready')
          mkMetaValidator.mockReturnValue(() => [notReadyError])

          const { result } = renderHook(() =>
            useMeta(Form.Err(new Error('Form error')), Schema.Loading, Manifest.Ready()),
          )

          expect(result.current.status).toEqual(Err(notReadyError))
        })

        it('should return ok status when schema is ready and validation passes', () => {
          mkMetaValidator.mockReturnValue(() => undefined)

          const { result } = renderHook(() =>
            useMeta(Form.Err(new Error('Form error')), SchemaReady, Manifest.Ready()),
          )

          act(() => {
            result.current.onChange({ valid: 'meta' })
          })

          expect(result.current.status).toEqual(Ok)
        })

        it('should return error status when schema validation fails', () => {
          const validationErrors = [new Error('Required field missing')]
          mkMetaValidator.mockReturnValue(() => validationErrors)

          const { result } = renderHook(() =>
            useMeta(Form.Err(new Error('Form error')), SchemaReady, Manifest.Ready()),
          )

          act(() => {
            result.current.onChange({ invalid: 'meta' })
          })

          expect(result.current.status).toEqual(Err(validationErrors))
        })
      })
    })
    describe('guided-metadata', () => {
      beforeEach(() => {
        useFeature.mockReturnValue(true)
      })

      it('validates before any submit, and reports untouched', () => {
        const validationErrors = [new Error('Required field missing')]
        mkMetaValidator.mockReturnValue(() => validationErrors)

        const { result } = renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Ready()),
        )

        expect(result.current.status).toEqual(Err(validationErrors))
        expect(result.current.guided).toBe(true)
        expect(result.current.touched).toBe(false)
      })

      it('validates the manifest metadata a revision would push', () => {
        const validate = vi.fn(() => undefined)
        mkMetaValidator.mockReturnValue(validate)

        renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Ready({ meta: { title: 'T' } })),
        )

        expect(validate).toHaveBeenCalledWith({ title: 'T' })
      })

      it('reports format errors as warnings without blocking', () => {
        const formatError = {
          keyword: 'format',
          instancePath: '/date',
          schemaPath: '#/properties/date/format',
          params: { format: 'date' },
          message: 'must match format "date"',
        }
        const requiredError = {
          keyword: 'required',
          instancePath: '',
          schemaPath: '#/required',
          params: { missingProperty: 'project' },
          message: "must have required property 'project'",
        }
        mkMetaValidator.mockReturnValueOnce(() => [formatError])

        const { result } = renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Ready()),
        )

        expect(result.current.status).toEqual(Ok)
        expect(result.current.warnings).toEqual([formatError])

        mkMetaValidator.mockReturnValueOnce(() => [formatError, requiredError])
        const { result: mixed } = renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Ready()),
        )

        expect(mixed.current.status).toEqual(Err([requiredError]))
        expect(mixed.current.warnings).toEqual([formatError])
      })

      it('marks the value touched after an edit', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(Form.Idle, SchemaReady, Manifest.Ready()),
        )
        act(() => {
          result.current.onChange({ title: 'T' })
        })

        expect(result.current.status).toEqual(Ok)
        expect(result.current.touched).toBe(true)
      })

      it('prefers the server field error after a rejected submit', () => {
        mkMetaValidator.mockReturnValue(() => undefined)
        const userMetaError = new Error('Rejected by server')

        const { result } = renderHook(() =>
          useMeta(
            Form.Err(new Error('Form error'), { userMeta: userMetaError }),
            SchemaReady,
            Manifest.Ready(),
          ),
        )

        expect(result.current.status).toEqual(Err(userMetaError))
      })

      it('drops the server field error once the metadata is edited', () => {
        mkMetaValidator.mockReturnValue(() => undefined)
        const form = Form.Err(new Error('Form error'), {
          userMeta: new Error('Rejected'),
        })

        const { result } = renderHook(() => useMeta(form, SchemaReady, Manifest.Ready()))
        act(() => {
          result.current.onChange({ title: 'Fixed' })
        })

        expect(result.current.status).toEqual(Ok)
      })
    })
  })
})
