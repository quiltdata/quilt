import { renderHook, act } from '@testing-library/react-hooks'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('constants/config', () => ({ default: { mode: 'LOCAL' } }))
vi.mock('./gql/Subscription.generated', () => ({ default: 'SUBSCRIPTION_QUERY' }))

const useQueryMock = vi.fn()
vi.mock('utils/GraphQL', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  fold: (_data: unknown, cases: Record<string, () => unknown>) => cases.fetching(),
}))

import { useState } from './Subscription'

describe('containers/NavBar/Subscription', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    window.sessionStorage.clear()
  })

  describe('useState (LOCAL mode)', () => {
    it('returns invalid=false in LOCAL mode', () => {
      useQueryMock.mockReturnValue({ fetching: true })
      const { result } = renderHook(() => useState())
      expect(result.current.invalid).toBe(false)
    })

    it('pauses query in LOCAL mode', () => {
      useQueryMock.mockReturnValue({ fetching: true })
      renderHook(() => useState())
      expect(useQueryMock).toHaveBeenCalledWith('SUBSCRIPTION_QUERY', undefined, {
        pause: true,
      })
    })

    it('starts with dismissed=false when sessionStorage is empty', () => {
      useQueryMock.mockReturnValue({ fetching: true })
      const { result } = renderHook(() => useState())
      expect(result.current.dismissed).toBe(false)
    })

    it('reads dismissed state from sessionStorage', () => {
      window.sessionStorage.setItem('quilt-license-error-dismissed', 'true')
      useQueryMock.mockReturnValue({ fetching: true })
      const { result } = renderHook(() => useState())
      expect(result.current.dismissed).toBe(true)
    })

    it('dismiss() sets dismissed=true and persists to sessionStorage', () => {
      useQueryMock.mockReturnValue({ fetching: true })
      const { result } = renderHook(() => useState())
      act(() => {
        result.current.dismiss()
      })
      expect(result.current.dismissed).toBe(true)
      expect(window.sessionStorage.getItem('quilt-license-error-dismissed')).toBe('true')
    })

    it('restore() sets dismissed=false and persists to sessionStorage', () => {
      window.sessionStorage.setItem('quilt-license-error-dismissed', 'true')
      useQueryMock.mockReturnValue({ fetching: true })
      const { result } = renderHook(() => useState())
      act(() => {
        result.current.restore()
      })
      expect(result.current.dismissed).toBe(false)
      expect(window.sessionStorage.getItem('quilt-license-error-dismissed')).toBe('false')
    })
  })
})
