import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as Form from './form'

describe('containers/Bucket/PackageDialog/State/form', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'crypto', {
      value: { subtle: { digest: vi.fn() } },
      writable: true,
    })
  })

  it('should return Idle when no initialOpen', () => {
    const { result } = renderHook(() => Form.use(false))
    expect(result.current.formStatus).toEqual(Form.Idle)
  })

  it('should return Ready when initialOpen is set', () => {
    const { result } = renderHook(() => Form.use(true))
    expect(result.current.formStatus).toEqual(Form.Ready)
  })

  it('should return error when window.crypto.subtle is not available', () => {
    Object.defineProperty(window, 'crypto', { value: undefined, writable: true })

    const { result } = renderHook(() => Form.use(false))
    expect(result.current.formStatus._tag).toBe('error')
  })
})
