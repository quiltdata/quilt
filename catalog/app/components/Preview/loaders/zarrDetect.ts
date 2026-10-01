// The root metadata file of a Zarr store: v2 `.zattrs` or v3 `zarr.json` directly inside
// a `*.zarr` directory.
const ROOT_METADATA_RE = /\.zarr\/(\.zattrs|zarr\.json)$/i

export const detect = (key: string) => ROOT_METADATA_RE.test(key)

// Only multiscale images get the viewer; other Zarr stores (tables, plates, label groups)
// keep the JSON preview a `zarr.json` had before.
export const isImage = (rootAttrs: string) => rootAttrs.includes('"multiscales"')
