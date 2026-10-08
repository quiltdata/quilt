import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as PackageUri from 'utils/PackageUri'

import { useState } from './State'

const { useLockStatus } = vi.hoisted(() => ({ useLockStatus: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/PackageLock', () => ({ useLockStatus }))

const actions = { revisePackage: true, writeFile: true }
const otherActions = { revisePackage: true, writeFile: true }
const { useForBucket } = vi.hoisted(() => ({ useForBucket: vi.fn() }))
vi.mock('utils/BucketPreferences', async () => {
  const BP = await vi.importActual<typeof import('utils/BucketPreferences')>(
    'utils/BucketPreferences',
  )
  useForBucket.mockImplementation(() =>
    BP.Result.Ok({ ui: { actions: otherActions } } as never),
  )
  return {
    ...BP,
    use: () => ({ prefs: BP.Result.Ok({ ui: { actions } } as never) }),
    useForBucket,
  }
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

  it('keeps a plain bucket file editable whatever writeFile says', () => {
    actions.writeFile = false
    search = '?edit=true'
    const { result } = renderHook(() => useState(handle))
    search = defaultSearch
    actions.writeFile = true
    expect(result.current.writable).toBe(true)
    expect(result.current.editing).toEqual({ brace: 'markdown' })
  })

  it('needs only writeFile, not revisePackage, to add to an unlocked package', () => {
    useLockStatus.mockReturnValue('unlocked')
    actions.revisePackage = false
    const { result } = renderHook(() => useState(handle))
    actions.revisePackage = true
    expect(result.current.writable).toBe(true)
  })

  it.each([
    [true, false],
    [false, true],
  ])(
    'decides writeFile from the target bucket (viewed %s, target %s)',
    (viewed, target) => {
      useLockStatus.mockReturnValue('unlocked')
      actions.writeFile = viewed
      otherActions.writeFile = target
      const other = PackageUri.stringify({ bucket: 'o', name: 'team/ds', path: 'f.md' })
      search = `?add=${encodeURIComponent(other)}&edit=true`
      const { result } = renderHook(() => useState(handle))
      search = defaultSearch
      actions.writeFile = true
      otherActions.writeFile = true
      expect(result.current.writable).toBe(target)
      expect(useForBucket).toHaveBeenLastCalledWith('o', false)
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

  it('keeps an editor opened while writable mounted across lock flips', () => {
    useLockStatus.mockReturnValue('unlocked')
    search = `?add=${encodeURIComponent(add)}`
    const { result, rerender } = renderHook(() => useState(handle))
    search = defaultSearch
    expect(result.current.editing).toBeNull()
    act(() => {
      result.current.onEdit({ brace: 'markdown' } as never)
      // The lock lands in the same batch as the click, before any effect runs.
      useLockStatus.mockReturnValue('locked')
    })
    const shown: unknown[] = [result.current.editing]
    useLockStatus.mockReturnValue('unlocked')
    rerender()
    shown.push(result.current.editing)
    useLockStatus.mockReturnValue('locked')
    rerender()
    shown.push(result.current.editing)
    expect(shown).toEqual([
      { brace: 'markdown' },
      { brace: 'markdown' },
      { brace: 'markdown' },
    ])
  })

  it('does not write when the package locks during the revision check', async () => {
    useLockStatus.mockReturnValue('unlocked')
    let head: () => void = () => {}
    const put = vi.fn()
    writeFile.mockImplementationOnce(async (_value: string, beforePut: () => void) => {
      await new Promise<void>((resolve) => {
        head = resolve
      })
      beforePut()
      put()
    })
    const { result, rerender } = renderHook(() => useState(handle))
    act(() => result.current.onChange('typed'))
    let saving: Promise<unknown> = Promise.resolve()
    act(() => {
      saving = result.current.onSave()
    })
    useLockStatus.mockReturnValue('locked')
    rerender()
    await act(async () => {
      head()
      await saving
    })
    expect(put).not.toHaveBeenCalled()
    expect(result.current.error?.message).toBe(
      "This package was locked; your changes can't be saved.",
    )
  })

  it('claims no lock when writing stops for another reason', () => {
    useLockStatus.mockReturnValue('unlocked')
    const { result, rerender } = renderHook(() => useState(handle))
    actions.writeFile = false
    rerender()
    actions.writeFile = true
    expect(result.current.editing).toEqual({ brace: 'markdown' })
    expect(result.current.writable).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it.each(['locked', 'loading'])(
    'says why the editor the URL asked for is closed while %s',
    (status) => {
      useLockStatus.mockReturnValue(status)
      const { result } = renderHook(() => useState(handle))
      expect(result.current.requested).toBe(status)
    },
  )

  it('asks for nothing once the editor opens', () => {
    useLockStatus.mockReturnValue('unlocked')
    const { result } = renderHook(() => useState(handle))
    expect(result.current.requested).toBeNull()
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
