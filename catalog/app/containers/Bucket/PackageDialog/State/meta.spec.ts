import { renderHook, act } from '@testing-library/react-hooks'
import { vi, beforeEach } from 'vitest'

import * as Form from './form'
import * as Manifest from './manifest'
import { useMeta, Err, Ok } from './meta'
import * as Schema from './schema'

vi.mock('constants/config', () => ({}))

const mkMetaValidator = vi.fn()
vi.mock('./schema', async () => {
  const actual = await vi.importActual('./schema')
  return {
    ...actual,
    mkMetaValidator: () => mkMetaValidator(),
  }
})

const SchemaReady = Schema.Ready()

describe('containers/Bucket/PackageDialog/State/meta', () => {
  describe('useMeta', () => {
    beforeEach(() => {
      vi.clearAllMocks()
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
  })
})
