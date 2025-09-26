import { renderHook, act } from '@testing-library/react-hooks'

import { useMeta } from './meta'

jest.mock('constants/config', () => ({}))

const mkMetaValidator = jest.fn()
jest.mock('./schema', () => ({
  mkMetaValidator: () => mkMetaValidator(),
}))

describe('containers/Bucket/PackageDialog/State/meta', () => {
  describe('useMeta', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    describe('value', () => {
      const form = { _tag: 'idle' } as const
      const schema = { _tag: 'ready', schema: {} } as const

      test('should use fallback meta from manifest when local meta is undefined', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(form, schema, {
            _tag: 'ready',
            manifest: { meta: { title: 'Test Package' } },
          }),
        )

        expect(result.current.value).toEqual({ title: 'Test Package' })
      })

      test('should prioritize local meta over manifest meta when both exist', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(form, schema, {
            _tag: 'ready',
            manifest: { meta: { title: 'Manifest Title' } },
          }),
        )

        act(() => {
          result.current.onChange({ title: 'Local Title' })
        })

        expect(result.current.value).toEqual({ title: 'Local Title' })
      })

      test('should return undefined when manifest is not ready and no local meta', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() => useMeta(form, schema, { _tag: 'loading' }))

        expect(result.current.value).toBeUndefined()
      })

      test('should return undefined when manifest is ready but has no meta and no local meta', () => {
        mkMetaValidator.mockReturnValue(() => undefined)

        const { result } = renderHook(() =>
          useMeta(form, schema, { _tag: 'ready', manifest: {} }),
        )

        expect(result.current.value).toBeUndefined()
      })
    })

    describe('status', () => {
      describe('form not in error state', () => {
        const form = { _tag: 'idle' } as const
        const schema = { _tag: 'ready', schema: {} } as const
        const manifest = { _tag: 'ready', manifest: undefined } as const

        test('should return ok status when form has no errors and validation passes', () => {
          mkMetaValidator.mockReturnValue(() => undefined)

          const { result } = renderHook(() => useMeta(form, schema, manifest))

          expect(result.current.status).toEqual({ _tag: 'ok' })
        })

        test('should ignore validation errors when form is not in error state', () => {
          const validationError = new Error('Validation failed')
          mkMetaValidator.mockReturnValue(() => [validationError])

          const { result } = renderHook(() => useMeta(form, schema, manifest))

          expect(result.current.status).toEqual({ _tag: 'ok' })
        })
      })

      describe('form in error state', () => {
        const form = { _tag: 'error', error: new Error('Form error') } as const
        const manifest = { _tag: 'ready', manifest: undefined } as const

        test('should return error status when form has userMeta field error', () => {
          mkMetaValidator.mockReturnValue(() => undefined)

          const userMetaError = new Error('Invalid metadata format')
          const formWithMetaError = {
            _tag: 'error',
            error: new Error('Form error'),
            fields: { userMeta: userMetaError },
          } as const

          const { result } = renderHook(() =>
            useMeta(formWithMetaError, { _tag: 'ready', schema: {} }, manifest),
          )

          expect(result.current.status).toEqual({
            _tag: 'error',
            errors: [userMetaError],
          })
        })

        test('should return error status when schema is in error state', () => {
          const schemaError = new Error('Schema loading failed')
          mkMetaValidator.mockReturnValue(() => [schemaError])

          const schema = { _tag: 'error', error: schemaError } as const

          const { result } = renderHook(() => useMeta(form, schema, manifest))

          expect(result.current.status).toEqual({
            _tag: 'error',
            errors: [schemaError],
          })
        })

        test('should return error status when schema is not ready (idle/loading)', () => {
          const notReadyError = new Error('Schema is not ready')
          mkMetaValidator.mockReturnValue(() => [notReadyError])

          const schema = { _tag: 'loading' } as const

          const { result } = renderHook(() => useMeta(form, schema, manifest))

          expect(result.current.status).toEqual({
            _tag: 'error',
            errors: [notReadyError],
          })
        })

        test('should return ok status when schema is ready and validation passes', () => {
          mkMetaValidator.mockReturnValue(() => undefined)

          const schema = { _tag: 'ready', schema: { type: 'object' } } as const

          const { result } = renderHook(() => useMeta(form, schema, manifest))

          act(() => {
            result.current.onChange({ valid: 'meta' })
          })

          expect(result.current.status).toEqual({ _tag: 'ok' })
        })

        test('should return error status when schema validation fails', () => {
          const validationErrors = [new Error('Required field missing')]
          mkMetaValidator.mockReturnValue(() => validationErrors)

          const schema = { _tag: 'ready', schema: { type: 'object' } } as const

          const { result } = renderHook(() => useMeta(form, schema, manifest))

          act(() => {
            result.current.onChange({ invalid: 'meta' })
          })

          expect(result.current.status).toEqual({
            _tag: 'error',
            errors: validationErrors,
          })
        })
      })
    })
  })
})
