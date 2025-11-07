import { renderHook } from '@testing-library/react-hooks'

import { DirHandleCreate } from 'containers/Bucket/Toolbar'

import { useCreateFileInBucket } from './CreateFile'

jest.mock('constants/config', () => ({}))

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(() => ({ push: jest.fn() })),
}))

const usePrompt = jest.fn()
jest.mock('components/Dialog', () => ({
  usePrompt: jest.fn(({ onSubmit }) => usePrompt({ onSubmit })),
}))

const toFile = jest.fn()
jest.mock('./routes', () => ({
  useAddFileInBucket: jest.fn(() => toFile),
}))

describe('useCreateFileInBucket', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
