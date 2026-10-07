import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as quiltConfigs from 'constants/quiltConfigs'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import { useEditBucketFile } from './routes'

interface WrapperProps {
  children: React.ReactNode
}

// `bucket`: whose flows to open; a copy/promote dialog targets another bucket than the page.
export function FlowsLink({
  children,
  bucket: target,
}: WrapperProps & { bucket?: string }) {
  const params = RRDom.useParams<{ bucket: string }>()
  const bucket = target || params.bucket
  invariant(bucket, '`bucket` must be defined')
  const { urls } = NamedRoutes.use()
  return <StyledLink to={urls.bucketWorkflowList(bucket)}>{children}</StyledLink>
}

export function WorkflowsConfigLink({ children }: WrapperProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(bucket, '`bucket` must be defined')

  const toConfig = useEditBucketFile({ bucket, key: quiltConfigs.workflows })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}
