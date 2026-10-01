import type * as Model from 'model'

type RangeQuery = { offset: number; length: number } | { suffixLength: number }

// zarrita's `AsyncReadable`: store-absolute key (`/0/.zarray`) to bytes, `undefined` when
// absent. `getRange` serves sharded Zarr v3 arrays, which read byte ranges of one object.
export interface ReadableStore {
  get(key: string): Promise<Uint8Array | undefined>
  getRange(key: string, range: RangeQuery): Promise<Uint8Array | undefined>
}

// Zarr probes for optional metadata (`.zgroup`, `.zarray`, `zarr.json`), so a missing key
// must read as `undefined`, not an error. S3 answers 403 rather than 404 when the caller
// cannot list the bucket.
const MISSING = [403, 404]

const rangeHeader = (r: RangeQuery) =>
  'suffixLength' in r
    ? `bytes=-${r.suffixLength}`
    : `bytes=${r.offset}-${r.offset + r.length - 1}`

export function createStore(
  resolvePath: (path: string) => Promise<Model.S3.S3ObjectLocation>,
  sign: (handle: Model.S3.S3ObjectLocation) => string,
  fetchImpl: typeof fetch = fetch,
): ReadableStore {
  async function read(key: string, init?: RequestInit) {
    let handle: Model.S3.S3ObjectLocation
    try {
      // ponytail: one logical-key lookup per chunk inside packages; batch via the
      // package dir listing if tile loads are slow on large stores
      handle = await resolvePath(key.replace(/^\//, ''))
    } catch {
      return undefined
    }
    const res = await fetchImpl(sign(handle), init)
    if (MISSING.includes(res.status)) return undefined
    if (!res.ok) throw new Error(`Failed to fetch ${key}: ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  return {
    get: (key) => read(key),
    getRange: (key, range) => read(key, { headers: { Range: rangeHeader(range) } }),
  }
}
