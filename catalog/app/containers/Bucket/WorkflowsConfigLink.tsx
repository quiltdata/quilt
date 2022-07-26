import * as React from 'react'

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
  const toConfig = `${urls.bucketFile(bucket, requests.WORKFLOWS_CONFIG_PATH)}?edit=true`
  return <StyledLink to={toConfig}>{children}</StyledLink>
}
