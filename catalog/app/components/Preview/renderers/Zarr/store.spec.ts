import { describe, expect, it, vi } from 'vitest'

import { createStore } from './store'

const resolvePath = async (path: string) => {
  if (path === 'gone') throw new Error(`Could not resolve logical key "${path}"`)
  if (path === 'offline') throw new Error('Network request failed')
  return { bucket: 'b', key: `root.zarr/${path}` }
}
const sign = ({ key }: { key: string }) => `https://s3/${key}`

const fetchFor = (status: number) =>
  vi.fn(
    async () =>
      new Response(status < 300 ? new Uint8Array([1, 2]) : null, {
        status,
      }),
  )

describe('components/Preview/renderers/Zarr/store', () => {
  it('resolves store keys relative to the store root and returns bytes', async () => {
    const fetchImpl = fetchFor(200)
    const store = createStore(resolvePath, sign, fetchImpl)
    expect(await store.get('/0/.zarray')).toEqual(new Uint8Array([1, 2]))
    expect(fetchImpl).toHaveBeenCalledWith('https://s3/root.zarr/0/.zarray', undefined)
  })

  it('treats 404 as missing for any key', async () => {
    const store = createStore(resolvePath, sign, fetchFor(404))
    expect(await store.get('/0/0.0.0.0')).toBeUndefined()
  })

  it('treats 403 as missing, since S3 denies absent keys to non-listing callers', async () => {
    const store = createStore(resolvePath, sign, fetchFor(403))
    expect(await store.get('/.zgroup')).toBeUndefined()
    expect(await store.get('/0/0.0.0.0')).toBeUndefined()
  })

  it('treats a key absent from the package as missing', async () => {
    const fetchImpl = fetchFor(200)
    const store = createStore(resolvePath, sign, fetchImpl)
    expect(await store.get('/gone')).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces resolver failures other than a missing key', async () => {
    const store = createStore(resolvePath, sign, fetchFor(200))
    await expect(store.get('/offline')).rejects.toThrow('Network request failed')
  })

  it.each([
    [{ offset: 10, length: 5 }, 'bytes=10-14'],
    [{ suffixLength: 16 }, 'bytes=-16'],
  ])('sends range %j as %s', async (range, header) => {
    const fetchImpl = fetchFor(206)
    const store = createStore(resolvePath, sign, fetchImpl)
    await store.getRange('/0/c/0/0', range)
    expect(fetchImpl).toHaveBeenCalledWith('https://s3/root.zarr/0/c/0/0', {
      headers: { Range: header },
    })
  })

  it.each([
    [{ offset: 1, length: 2 }, [2, 3]],
    [{ suffixLength: 2 }, [3, 4]],
  ])(
    'slices %j itself when the server answers 200 with the whole object',
    async (range, want) => {
      const whole = vi.fn(
        async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
      )
      const store = createStore(resolvePath, sign, whole)
      expect(await store.getRange('/0/c/0/0', range)).toEqual(new Uint8Array(want))
    },
  )

  it('throws on other HTTP errors', async () => {
    const store = createStore(resolvePath, sign, fetchFor(500))
    await expect(store.get('/0/0.0.0.0')).rejects.toThrow('500')
  })
})
