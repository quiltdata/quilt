import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'

interface RedirectProps {
  parsed: PackageUri.PackageUri
  decoded: string
}

export default function Redirect({
  parsed: { bucket, name, hash, tag, path },
  decoded: resolvedFrom,
}: RedirectProps) {
  const { urls } = NamedRoutes.use()
  const to =
    urls.bucketPackageTree(bucket, name, hash || tag, path) +
    NamedRoutes.mkSearch({ resolvedFrom })

  return <RRDom.Redirect to={to} />
}
