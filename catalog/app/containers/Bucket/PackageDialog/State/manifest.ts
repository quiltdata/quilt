import * as React from 'react'

import { Manifest, useManifest } from '../Manifest'

export type ManifestStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready'; manifest: Manifest | undefined }

export interface PackageSrc {
  bucket: string
  name: string
  hash?: string
}

export function isPackageHandle(h: PackageSrc): h is Required<PackageSrc> {
  return !!h.hash
}

export function useManifestRequest(open: boolean, src?: PackageSrc): ManifestStatus {
  const pause = !src || !open
  const data = useManifest({
    bucket: src?.bucket || '',
    name: src?.name || '',
    hashOrTag: src?.hash,
    pause,
  })
  return React.useMemo(() => {
    if (!open) return { _tag: 'idle' }
    if (!src) return { _tag: 'ready' }
    return data.case({
      Ok: (manifest: Manifest | undefined) => ({ _tag: 'ready', manifest }),
      Pending: () => ({ _tag: 'loading' }),
      Init: () => ({ _tag: 'idle' }),
      Err: (error: Error) => ({ _tag: 'error', error }),
    })
  }, [src, open, data])
}
