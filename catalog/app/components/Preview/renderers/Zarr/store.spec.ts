import { describe, expect, it, vi } from 'vitest'

import { createStore } from './store'

const resolvePath = async (path: string) => {
  if (path === 'gone') throw new Error('no such logical key')
  return { bucket: 'b', key: `root.zarr/${path}` }
}
const sign = ({ key }: { key: string }) => `https://s3/${key}`

const fetchFor = (status: number) =>
  vi.fn(
    async () => new Response(status === 200 ? new Uint8Array([1, 2]) : null, { status }),
  )

describe('components/Preview/renderers/Zarr/store', () => {
  it('resolves store keys relative to the store root and returns bytes', async () => {
    const fetchImpl = fetchFor(200)
    const store = createStore(resolvePath, sign, fetchImpl)
    expect(await store.get('/0/.zarray')).toEqual(new Uint8Array([1, 2]))
    expect(fetchImpl).toHaveBeenCalledWith('https://s3/root.zarr/0/.zarray', undefined)
  })

  it.each([403, 404])('treats HTTP %i as a missing key', async (status) => {
    const store = createStore(resolvePath, sign, fetchFor(status))
    expect(await store.get('/.zgroup')).toBeUndefined()
  })

  it('treats an unresolvable logical key as missing', async () => {
    const fetchImpl = fetchFor(200)
    const store = createStore(resolvePath, sign, fetchImpl)
    expect(await store.get('/gone')).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    [{ offset: 10, length: 5 }, 'bytes=10-14'],
    [{ suffixLength: 16 }, 'bytes=-16'],
  ])('sends range %j as %s', async (range, header) => {
    const fetchImpl = fetchFor(200)
    const store = createStore(resolvePath, sign, fetchImpl)
    await store.getRange('/0/c/0/0', range)
    expect(fetchImpl).toHaveBeenCalledWith('https://s3/root.zarr/0/c/0/0', {
      headers: { Range: header },
    })
  })

  it('throws on other HTTP errors', async () => {
    const store = createStore(resolvePath, sign, fetchFor(500))
    await expect(store.get('/0/0.0.0.0')).rejects.toThrow('500')
  })
})
