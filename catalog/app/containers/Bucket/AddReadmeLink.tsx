import path from 'path'

import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type { PackageHandle } from 'utils/packageHandle'

interface AddReadmeLinkProps {
  packageHandle: PackageHandle
  children: React.ReactNode
}

export default function AddReadmeLink({ packageHandle, children }: AddReadmeLinkProps) {
  const { bucket, name } = packageHandle
  const { urls } = NamedRoutes.use()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  const toConfig = urls.bucketFileEdit(
    bucket,
    path.join(name, 'README.md'),
    undefined,
    next,
    true,
  )
  return <StyledLink to={toConfig}>{children}</StyledLink>
}
