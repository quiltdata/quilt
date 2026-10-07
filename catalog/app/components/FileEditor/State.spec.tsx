import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as PackageUri from 'utils/PackageUri'

import { useState } from './State'

const { useLockStatus } = vi.hoisted(() => ({ useLockStatus: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/PackageLock', () => ({ useLockStatus }))
vi.mock('./loader', () => ({
  detect: () => [{ brace: 'markdown' }],
  useWriteData: () => vi.fn(),
}))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ urls: {} }) }))

const add = PackageUri.stringify({ bucket: 'b', name: 'team/ds', path: 'README.md' })

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() }),
  useLocation: () => ({ search: `?add=${encodeURIComponent(add)}&edit=true` }),
}))

const handle = { bucket: 'b', key: 'team/ds/README.md' }

describe('components/FileEditor/State', () => {
  it('opens the editor from the URL', () => {
    useLockStatus.mockReturnValue('unlocked')
    const { result } = renderHook(() => useState(handle))
    expect(result.current.editing).toEqual({ brace: 'markdown' })
    expect(result.current.writable).toBe(true)
  })

  it.each(['locked', 'loading'])(
    'keeps the editor closed while the target package is %s',
    (status) => {
      useLockStatus.mockReturnValue(status)
      const { result } = renderHook(() => useState(handle))
      expect(result.current.editing).toBeNull()
      expect(result.current.writable).toBe(false)
      expect(useLockStatus).toHaveBeenCalledWith('b', 'team/ds', false)
    },
  )

  it('opens the editor once a loading lock turns out unlocked', () => {
    useLockStatus.mockReturnValue('loading')
    const { result, rerender } = renderHook(() => useState(handle))
    expect(result.current.editing).toBeNull()
    useLockStatus.mockReturnValue('unlocked')
    rerender()
    expect(result.current.editing).toEqual({ brace: 'markdown' })
  })
})
