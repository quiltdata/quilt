import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as quiltConfigs from 'constants/quiltConfigs'
import StyledLink from 'utils/StyledLink'

import { useEditBucketFile } from './routes'

interface WrapperProps {
  children: React.ReactNode
}

export function WorkflowsConfigLink({ children }: WrapperProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(bucket, '`bucket` must be defined')

  const toConfig = useEditBucketFile({ bucket, key: quiltConfigs.workflows })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}
