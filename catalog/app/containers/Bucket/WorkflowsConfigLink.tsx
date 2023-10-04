import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

interface WorkflowsConfigLinkProps {
  bucket: string
  children: React.ReactNode
}

// TODO: add any file rather than specific add workflows config file
//       move it to components/FileEditor directory because purpose of this link is to edit file
export default function WorkflowsConfigLink({
  bucket,
  children,
}: WorkflowsConfigLinkProps) {
  const { urls } = NamedRoutes.use()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  const toConfig = urls.bucketFile(bucket, requests.WORKFLOWS_CONFIG_PATH, { next })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}
