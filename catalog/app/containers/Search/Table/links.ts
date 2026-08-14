import { join } from 'path'

import * as React from 'react'

import type { RouteMap } from 'containers/Bucket/Routes'
import type { S3ObjectLocation } from 'model/S3'
import * as NamedRoutes from 'utils/NamedRoutes'
import type { PackageHandle } from 'utils/packageHandle'

// Data-source-agnostic seam for the package-listing leaves:
// consumers (e.g. virtual "bucket" screens) can override where package links lead
// without touching the presentational components.
export interface PackageLinkBuilder {
  /** Primary link target for a package hit (package tree or detail page). */
  packageRoot: (handle: PackageHandle, pointer: string) => string
  /** Package detail page (referenced from the matching entries footer). */
  packageDetail: (handle: PackageHandle) => string
  /** An entry inside the package tree at the handle's hash. */
  packageEntry: (handle: PackageHandle, logicalKey: string) => string
  /** The package's manifest file (referenced from the hash cell). */
  manifest: (handle: PackageHandle) => string
  /** The physical object a package entry points to. */
  physicalObject: (location: S3ObjectLocation) => string
  /** The bucket containing the package (bucket cell). */
  bucket: (bucket: string) => string
}

/** Default `PackageLinkBuilder` producing in-bucket routes from `NamedRoutes`. */
export function useBucketLinks(): PackageLinkBuilder {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useMemo(
    () => ({
      packageRoot: ({ bucket, name, hash }, pointer) =>
        urls.bucketPackageTree(bucket, name, pointer === 'latest' ? pointer : hash),
      packageDetail: ({ bucket, name }) => urls.bucketPackageDetail(bucket, name),
      packageEntry: ({ bucket, name, hash }, logicalKey) =>
        urls.bucketPackageTree(bucket, name, hash, logicalKey),
      manifest: ({ bucket, hash }) =>
        urls.bucketFile(bucket, join('.quilt/packages', hash)),
      physicalObject: ({ bucket, key, version }) =>
        urls.bucketFile(bucket, key, { version }),
      bucket: (bucket) => urls.bucketPackageList(bucket),
    }),
    [urls],
  )
}
