import { renderHook } from '@testing-library/react-hooks'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { useAthenaCredentials } from './Credentials'

const authenticatedMock = vi.fn(() => true)

vi.mock('react-redux', () => ({
  useSelector: (selector: () => unknown) => selector(),
}))

vi.mock('containers/Auth/selectors', () => ({
  authenticated: () => authenticatedMock(),
}))

const reqMock: ReturnType<typeof vi.fn> = vi.fn(() => new Promise(() => {}))

vi.mock('utils/APIConnector', () => ({
  use: () => reqMock,
}))

vi.mock('constants/config', () => ({ default: { mode: 'PRODUCT' } }))

vi.mock('utils/logout', () => ({ default: () => {} }))

describe('utils/AWS/Credentials', () => {
  describe('useAthenaCredentials', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      authenticatedMock.mockReturnValue(true)
    })

    it('returns null when the user is not authenticated', () => {
      authenticatedMock.mockReturnValue(false)
      const { result } = renderHook(() => useAthenaCredentials())
      expect(result.current).toBeNull()
    })

    it('returns credentials that request the Athena-scoped endpoint', () => {
      const { result } = renderHook(() => useAthenaCredentials())
      expect(result.current).not.toBeNull()

      // Trigger a credential refresh; this must hit the Athena-scoped endpoint,
      // not the default /auth/get_credentials one.
      result.current!.refresh(() => {})

      expect(reqMock).toHaveBeenCalledTimes(1)
      const callArg = reqMock.mock.calls[0][0] as { endpoint: string }
      expect(callArg.endpoint).toBe('/auth/get_credentials?service=athena')
    })

    it('does not fall back to the default (unscoped) credentials endpoint', () => {
      const { result } = renderHook(() => useAthenaCredentials())
      result.current!.refresh(() => {})

      expect(reqMock).toHaveBeenCalledTimes(1)
      const callArg = reqMock.mock.calls[0][0] as { endpoint: string }
      // Guard against regression: the default credentials path is the plain
      // endpoint with no service query param.
      expect(callArg.endpoint).not.toBe('/auth/get_credentials')
      expect(callArg.endpoint).toMatch(/service=athena/)
    })
  })
})
