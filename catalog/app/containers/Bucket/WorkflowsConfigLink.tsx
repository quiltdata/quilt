import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

interface WorkflowsConfigLinkProps {
  bucket: string
  children: React.ReactNode
}

export default function WorkflowsConfigLink({
  bucket,
  children,
}: WorkflowsConfigLinkProps) {
  const { urls } = NamedRoutes.use()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  const toConfig = urls.bucketFileEdit(
    bucket,
    requests.WORKFLOWS_CONFIG_PATH,
    undefined,
    next,
  )
  return <StyledLink to={toConfig}>{children}</StyledLink>
}
