import type * as Model from 'model'

type RangeQuery = { offset: number; length: number } | { suffixLength: number }

// zarrita's `AsyncReadable`: store-absolute key (`/0/.zarray`) to bytes, `undefined` when
// absent. `getRange` serves sharded Zarr v3 arrays, which read byte ranges of one object.
export interface ReadableStore {
  get(key: string): Promise<Uint8Array | undefined>
  getRange(key: string, range: RangeQuery): Promise<Uint8Array | undefined>
}

export interface StoreOptions {
  // In a plain bucket S3 answers 403 for an absent key when the caller cannot list it, and
  // sparse arrays omit empty chunks, so 403 must read as missing. A package already says
  // which entries exist, so there a 403 is a real denial.
  forbiddenIsMissing: boolean
  // The root metadata file is known to exist (the loader read it), so a 403 on it is
  // always a denial, never an absent key.
  rootPath: string
}

// Prefix of the package LogicalKeyResolver's error for a path the revision lacks.
export const NOT_IN_PACKAGE = 'Could not resolve logical key'

const rangeHeader = (r: RangeQuery) =>
  'suffixLength' in r
    ? `bytes=-${r.suffixLength}`
    : `bytes=${r.offset}-${r.offset + r.length - 1}`

export function createStore(
  resolvePath: (path: string) => Promise<Model.S3.S3ObjectLocation>,
  sign: (handle: Model.S3.S3ObjectLocation) => string,
  { forbiddenIsMissing, rootPath }: StoreOptions,
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
    // The root was read by the loader; losing it now (deleted, or only an old version
    // exists) must not read as an empty store with default layout.
    if (res.status === 404 && path === rootPath)
      throw new Error(`${path} no longer exists`)
    if (res.status === 404) return undefined
    if (res.status === 403) {
      if (forbiddenIsMissing && path !== rootPath) return undefined
      throw new Error(`Access denied to ${path}`)
    }
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
    // A server that ignores Range answers 200 with the whole object; slicing it would
    // download a whole shard once per inner chunk.
    if (range && res.status !== 206) throw new Error(`Range not honoured for ${path}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  return {
    get: (key) => read(key),
    getRange: (key, range) => read(key, range),
  }
}
