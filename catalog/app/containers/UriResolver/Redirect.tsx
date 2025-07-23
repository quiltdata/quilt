import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'

interface RedirectProps {
  decoded: string
  parsed: PackageUri.PackageUri
}

export default function Redirect({
  decoded: resolvedFrom,
  parsed: { bucket, name, hash, tag, path },
}: RedirectProps) {
  const { urls } = NamedRoutes.use()
  const query = NamedRoutes.mkSearch({ resolvedFrom })
  const to = urls.bucketPackageTree(bucket, name, hash || tag, path) + query
  return <RRDom.Redirect to={to} />
}
