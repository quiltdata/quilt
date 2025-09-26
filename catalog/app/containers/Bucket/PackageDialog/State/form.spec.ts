import { renderHook } from '@testing-library/react-hooks'

import * as Form from './form'

describe('containers/Bucket/PackageDialog/State/form', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'crypto', {
      value: { subtle: { digest: jest.fn() } },
      writable: true,
    })
  })

  test('should return Idle when no initialOpen', () => {
    const { result } = renderHook(() => Form.use(false))
    expect(result.current.formStatus).toEqual(Form.Idle)
  })

  test('should return Ready when initialOpen is set', () => {
    const { result } = renderHook(() => Form.use(true))
    expect(result.current.formStatus).toEqual(Form.Ready)
  })

  test('should return Ready when initialOpen is file object', () => {
    const filesState = { foo: { bucket: 'bar', key: 'foo', size: 0 } }

    const { result } = renderHook(() => Form.use(filesState))
    expect(result.current.formStatus).toEqual(Form.Ready)
  })

  test('should return error when window.crypto.subtle is not available', () => {
    Object.defineProperty(window, 'crypto', { value: undefined, writable: true })

    const { result } = renderHook(() => Form.use(false))
    expect(result.current.formStatus._tag).toBe('error')
  })
})
