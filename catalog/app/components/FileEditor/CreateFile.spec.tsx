import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react-hooks'

import { DirHandleCreate } from 'containers/Bucket/Toolbar'
import noop from 'utils/noop'

import { useCreateFileInBucket } from './CreateFile'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: noop }),
}))

const usePrompt = vi.fn()
vi.mock('components/Dialog', () => ({
  usePrompt: ({ onSubmit }: { onSubmit: (v: string) => void }) => usePrompt({ onSubmit }),
}))

const toFile = vi.fn()
vi.mock('./routes', () => ({ useAddFileInBucket: () => toFile }))

describe('useCreateFileInBucket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call toFile with path with no leading slash', () => {
    renderHook(() => useCreateFileInBucket('foo', 'bar/'))

    usePrompt.mock.calls[0][0].onSubmit('something')

    expect(toFile).toHaveBeenCalledWith('bar/something')
  })

  describe('what happens with invalid path having leading slash', () => {
    it('should call toFile with path with leading slash', () => {
      // We "document" the flaw by this test.
      //
      // These conditions don't met,
      // because we call `useCreateFileInBucket` with `path` from Toolbar.DirHandle,
      // which don't have leading slash

      renderHook(() => useCreateFileInBucket('foo', '/bar/'))

      usePrompt.mock.calls[0][0].onSubmit('something')

      expect(toFile).toHaveBeenCalledWith('/bar/something')
    })

    it('should call toFile with Toolbar.DirHandle, stripping leading slash', () => {
      const { bucket, path } = DirHandleCreate('foo', '/bar/')

      renderHook(() => useCreateFileInBucket(bucket, path))

      usePrompt.mock.calls[0][0].onSubmit('something')

      expect(toFile).toHaveBeenCalledWith('bar/something')
    })
  })
})
