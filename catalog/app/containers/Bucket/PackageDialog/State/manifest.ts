import * as React from 'react'

import { Manifest, useManifest } from '../Manifest'

export type ManifestStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready'; manifest: Manifest | undefined }

export const Idle = { _tag: 'idle' as const }
export const Loading = { _tag: 'loading' as const }
export const Err = (error: Error) => ({ _tag: 'error' as const, error })
export const Ready = (manifest?: Manifest) => ({ _tag: 'ready' as const, manifest })

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
    if (!open) return Idle
    if (!src) return Ready()
    return data.case({ Ok: Ready, Pending: () => Loading, Init: () => Idle, Err })
  }, [src, open, data])
}
