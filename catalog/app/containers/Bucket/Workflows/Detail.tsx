import * as React from 'react'
import * as M from '@material-ui/core'

import Message from 'components/Message'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as workflows from 'utils/workflows'

interface DetailProps {
  bucket: string
  slug: string
  workflow: workflows.Workflow
}

function Detail({ workflow }: DetailProps) {
  return (
    <>
      <M.Typography variant="h5">{workflow.name}</M.Typography>
      {workflow.description}
    </>
  )
}

interface WrapperProps {
  bucket: string
  slug: string
  config: workflows.WorkflowsConfig
}

export default function WorkflowDetailWrapper({ bucket, slug, config }: WrapperProps) {
  const { urls } = NamedRoutes.use()

  const workflow = React.useMemo(
    () => config.workflows.find((w) => w.slug === slug),
    [config, slug],
  )

  return (
    <>
      <M.Typography variant="body1">
        <StyledLink to={urls.bucketWorkflowList(bucket)}>Workflows</StyledLink> / {slug}
      </M.Typography>
      {workflow ? (
        <Detail bucket={bucket} slug={slug} workflow={workflow} />
      ) : (
        <Message headline="Workflow Not Found">
          Workflow "{slug}" not found in this bucket.
        </Message>
      )}
    </>
  )
}
