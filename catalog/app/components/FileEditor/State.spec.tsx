import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as PackageUri from 'utils/PackageUri'

import { useState } from './State'

const { useLock } = vi.hoisted(() => ({ useLock: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('containers/Bucket/PackageTree/PackageLock', () => ({ useLock }))
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
    useLock.mockReturnValue({ lock: null })
    const { result } = renderHook(() => useState(handle))
    expect(result.current.editing).toEqual({ brace: 'markdown' })
  })

  it('keeps the editor closed when the target package is locked', () => {
    useLock.mockReturnValue({ lock: { hash: 'h' } })
    const { result } = renderHook(() => useState(handle))
    expect(result.current.editing).toBeNull()
    expect(useLock).toHaveBeenCalledWith('b', 'team/ds', false)
  })
})
