const ROOT_METADATA_RE = /\.zarr\/(\.zattrs|zarr\.json)$/i

export const detect = (key: string) => ROOT_METADATA_RE.test(key)

// Other Zarr stores (tables, plates, label groups) keep the JSON preview. Parsed, because
// a v3 plate's consolidated metadata names its child images' `multiscales`.
export function isImage(rootAttrs: string) {
  try {
    const j = JSON.parse(rootAttrs)
    return !!(
      j.multiscales ||
      j.attributes?.ome?.multiscales ||
      j.attributes?.multiscales
    )
  } catch {
    // Cut off at the scan limit: only a `multiscales` ahead of any child metadata counts.
    const m = rootAttrs.indexOf('"multiscales"')
    const c = rootAttrs.indexOf('"consolidated_metadata"')
    return m !== -1 && (c === -1 || m < c)
  }
}
