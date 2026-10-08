import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as PackageUri from 'utils/PackageUri'

import { useState } from './State'

const { useLockStatus } = vi.hoisted(() => ({ useLockStatus: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/PackageLock', () => ({ useLockStatus }))

const actions = { revisePackage: true, writeFile: true }
vi.mock('utils/BucketPreferences', async () => {
  const BP = await vi.importActual<typeof import('utils/BucketPreferences')>(
    'utils/BucketPreferences',
  )
  return { ...BP, use: () => ({ prefs: BP.Result.Ok({ ui: { actions } } as never) }) }
})
const { writeFile } = vi.hoisted(() => ({ writeFile: vi.fn() }))
vi.mock('./loader', () => ({
  detect: () => [{ brace: 'markdown' }],
  useWriteData: () => writeFile,
}))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ urls: {} }) }))

const add = PackageUri.stringify({ bucket: 'b', name: 'team/ds', path: 'README.md' })
const defaultSearch = `?add=${encodeURIComponent(add)}&edit=true`
let search = defaultSearch

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() }),
  useLocation: () => ({ search }),
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

  it('is not writable when bucket preferences turn off writeFile', () => {
    useLockStatus.mockReturnValue('unlocked')
    actions.writeFile = false
    const { result } = renderHook(() => useState(handle))
    actions.writeFile = true
    expect(result.current.writable).toBe(false)
    expect(result.current.editing).toBeNull()
  })

  it('needs only writeFile, not revisePackage, to add to an unlocked package', () => {
    useLockStatus.mockReturnValue('unlocked')
    actions.revisePackage = false
    const { result } = renderHook(() => useState(handle))
    actions.revisePackage = true
    expect(result.current.writable).toBe(true)
  })

  it('opens the editor once a loading lock turns out unlocked', () => {
    useLockStatus.mockReturnValue('loading')
    const { result, rerender } = renderHook(() => useState(handle))
    expect(result.current.editing).toBeNull()
    useLockStatus.mockReturnValue('unlocked')
    rerender()
    expect(result.current.editing).toEqual({ brace: 'markdown' })
  })

  it('keeps the typed text read-only with a notice when the package locks mid-edit', async () => {
    useLockStatus.mockReturnValue('unlocked')
    const { result, rerender } = renderHook(() => useState(handle))
    act(() => result.current.onChange('typed'))
    useLockStatus.mockReturnValue('locked')
    rerender()
    expect(result.current.editing).toEqual({ brace: 'markdown' })
    expect(result.current.value).toBe('typed')
    expect(result.current.writable).toBe(false)
    expect(result.current.error?.message).toBe(
      "This package was locked; your changes can't be saved.",
    )
    expect(await result.current.onSave()).toBeUndefined()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it.each([
    ['does not parse', 'not-a-package-uri'],
    ['has no path', PackageUri.stringify({ bucket: 'b', name: 'team/ds' })],
  ])('is not writable when the add parameter %s', (_label, uri) => {
    useLockStatus.mockReturnValue('unlocked')
    search = `?add=${encodeURIComponent(uri)}&edit=true`
    const { result } = renderHook(() => useState(handle))
    search = defaultSearch
    expect(result.current.writable).toBe(false)
    expect(result.current.editing).toBeNull()
  })
})
