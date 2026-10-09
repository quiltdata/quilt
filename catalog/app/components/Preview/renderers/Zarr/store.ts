import type * as Model from 'model'

type RangeQuery = { offset: number; length: number } | { suffixLength: number }

// zarrita's `AsyncReadable`: store-absolute key (`/0/.zarray`) to bytes, `undefined` when
// absent. `getRange` serves sharded Zarr v3 arrays, which read byte ranges of one object.
export interface ReadableStore {
  get(key: string): Promise<Uint8Array | undefined>
  getRange(key: string, range: RangeQuery): Promise<Uint8Array | undefined>
}

// S3 answers 403 rather than 404 for an absent key when the caller cannot list the
// bucket, and sparse arrays omit empty chunks, so 403 has to read as missing too. Access
// is granted per bucket or prefix, so a store whose metadata loaded is readable as a whole.
const MISSING = [403, 404]

// Prefix of the package LogicalKeyResolver's error for a path the revision lacks.
export const NOT_IN_PACKAGE = 'Could not resolve logical key'

const rangeHeader = (r: RangeQuery) =>
  'suffixLength' in r
    ? `bytes=-${r.suffixLength}`
    : `bytes=${r.offset}-${r.offset + r.length - 1}`

const sliceRange = (bytes: Uint8Array, r: RangeQuery) =>
  'suffixLength' in r
    ? bytes.subarray(Math.max(0, bytes.length - r.suffixLength))
    : bytes.subarray(r.offset, r.offset + r.length)

export function createStore(
  resolvePath: (path: string) => Promise<Model.S3.S3ObjectLocation>,
  sign: (handle: Model.S3.S3ObjectLocation) => string,
  fetchImpl: typeof fetch = fetch,
): ReadableStore {
  async function read(key: string, range?: RangeQuery) {
    const path = key.replace(/^\//, '')
    let handle: Model.S3.S3ObjectLocation
    try {
      // ponytail: one logical-key lookup per chunk inside packages; batch via the
      // package dir listing if tile loads are slow on large stores
      handle = await resolvePath(path)
    } catch (e) {
      // Absent from the package: missing metadata, or a sparse chunk never written. Any
      // other failure (network, GraphQL) must surface rather than render as fill value.
      if (e instanceof Error && e.message.startsWith(NOT_IN_PACKAGE)) return undefined
      throw e
    }
    const init = range && { headers: { Range: rangeHeader(range) } }
    const res = await fetchImpl(sign(handle), init)
    if (MISSING.includes(res.status)) return undefined
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    // A server that ignores Range answers 200 with the whole object.
    return range && res.status !== 206 ? sliceRange(bytes, range) : bytes
  }
  return {
    get: (key) => read(key),
    getRange: (key, range) => read(key, range),
  }
}
