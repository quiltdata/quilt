import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

interface WrapperProps {
  children: React.ReactNode
  edit?: boolean
}

interface EditLinkProps extends WrapperProps {
  path: string
}

// TODO: add any file rather than specific add workflows config file
//       move it to components/FileEditor directory because purpose of this link is to edit file
export function EditLink({ children, edit, path }: EditLinkProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  const { urls } = NamedRoutes.use()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  const toConfig = urls.bucketFile(bucket, path, { edit, next })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}

export function WorkflowsConfigLink({ children, edit = false }: WrapperProps) {
  return (
    <EditLink edit={edit} path={requests.WORKFLOWS_CONFIG_PATH}>
      {children}
    </EditLink>
  )
}

export function BucketPreferencesConfigLink({ children, edit = false }: WrapperProps) {
  return (
    <EditLink edit={edit} path={'.quilt/catalog/config.yaml'}>
      {children}
    </EditLink>
  )
}
