import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { PUSH_STOPPED, useUploads } from './Uploads'

const { started, finish } = vi.hoisted(() => ({
  started: [] as string[],
  finish: [] as (() => void)[],
}))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/AWS', () => ({
  S3: {
    use: () => ({
      upload: ({ Key }: { Key: string }) => {
        started.push(Key)
        const p = new Promise((resolve) => {
          finish.push(() => resolve({ Key, VersionId: 'v' }))
        })
        return { on: () => {}, abort: () => {}, promise: () => p }
      },
    }),
  },
}))

const file = (name: string) =>
  ({ name, size: 1, hash: { promise: Promise.resolve(), value: 'h' } }) as never

describe('containers/Bucket/PackageDialog/Uploads', () => {
  it('starts no queued upload once the destination stops being pushable', async () => {
    let pushable = true
    const { result } = renderHook(() => useUploads())
    let uploading: Promise<unknown> = Promise.resolve()
    act(() => {
      uploading = result.current.upload({
        files: ['a', 'b', 'c'].map((p) => ({ path: p, file: file(p) })),
        bucket: 'b',
        getCanonicalKey: (p) => p,
        canStart: () => pushable,
      })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(started).toEqual(['a', 'b'])
    pushable = false
    await act(async () => {
      finish.forEach((f) => f())
      await expect(uploading).rejects.toThrow(PUSH_STOPPED)
    })
    expect(started).toEqual(['a', 'b'])
  })
})
