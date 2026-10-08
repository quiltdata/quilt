import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { Result } from './BucketPreferences'
import { useForBucket } from './Provider'

vi.mock('constants/config', () => ({ default: { mode: 'PRODUCT' } }))

vi.mock('utils/AWS', () => ({ S3: { use: () => ({}) } }))

const bodies: Record<string, string> = {
  a: 'ui:\n  actions:\n    writeFile: true\n',
  b: 'ui:\n  actions:\n    writeFile: false\n',
}
const pending: Record<string, (v: unknown) => void> = {}

vi.mock('containers/Bucket/requests', () => ({
  fetchFileInCollection: ({ handles }: { handles: { bucket: string; key: string }[] }) =>
    new Promise((resolve) => {
      const { bucket, key } = handles[0]
      pending[bucket] = () => resolve({ handle: { bucket, key }, body: bodies[bucket] })
    }),
}))

const writeFile = (r: Result) =>
  Result.match({ Ok: ({ ui: { actions } }) => actions.writeFile, _: () => null }, r)

describe('utils/BucketPreferences/useForBucket', () => {
  it("is Pending while a new target loads, not the previous target's prefs", async () => {
    const { result, rerender, waitFor } = renderHook(({ b }) => useForBucket(b), {
      initialProps: { b: 'a' },
    })
    pending.a(null)
    await waitFor(() => expect(writeFile(result.current)).toBe(true))

    rerender({ b: 'b' })
    expect(Result.Pending.is(result.current)).toBe(true)

    pending.b(null)
    await waitFor(() => expect(writeFile(result.current)).toBe(false))
  })
})
