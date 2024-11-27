import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

// TODO: move it to components/FileEditor directory because purpose of this link is to edit file

function useRouteToEditFile(bucket: string, path: string) {
  const { urls } = NamedRoutes.use()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  return urls.bucketFile(bucket, path, { edit: true, next })
}

interface WrapperProps {
  children: React.ReactNode
}

export function WorkflowsConfigLink({ children }: WrapperProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  const toConfig = useRouteToEditFile(bucket, requests.WORKFLOWS_CONFIG_PATH)
  return <StyledLink to={toConfig}>{children}</StyledLink>
}

interface MissingSourceBucketProps {
  className?: string
}

export function MissingSourceBucket({ className }: MissingSourceBucketProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  const prefs = BucketPreferences.use()

  const toConfig = useRouteToEditFile(bucket, '.quilt/catalog/config.yaml')

  const handleAutoAdd = React.useCallback(() => {
    alert('Not implemented')
  }, [])

  if (!BucketPreferences.Result.Ok.is(prefs)) return null

  return (
    <div className={className}>
      <M.Typography variant="caption" component="p">
        <Code>{bucket}</Code> bucket is missing from <Code>ui.sourceBuckets</Code>{' '}
        in the config.
      </M.Typography>
      <M.Typography variant="caption" component="p">
        <StyledLink to={toConfig}>Edit manually</StyledLink> or{' '}
        <StyledLink onClick={handleAutoAdd}>auto-add it</StyledLink>
      </M.Typography>
    </div>
  )
}
