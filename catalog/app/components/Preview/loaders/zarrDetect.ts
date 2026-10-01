const ROOT_METADATA_RE = /\.zarr\/(\.zattrs|zarr\.json)$/i

export const detect = (key: string) => ROOT_METADATA_RE.test(key)

// Other Zarr stores (tables, plates, label groups) keep the JSON preview.
export const isImage = (rootAttrs: string) => rootAttrs.includes('"multiscales"')
