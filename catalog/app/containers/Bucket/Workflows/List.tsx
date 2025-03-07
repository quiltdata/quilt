import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import * as workflows from 'utils/workflows'

const ListItemLink = React.forwardRef<any, any>(function ListItemLink(props, ref) {
  return <RR.Link ref={ref} {...props} />
})

interface WorkflowListProps {
  bucket: string
  config: workflows.WorkflowsConfig
}

export default function WorkflowList({ bucket, config }: WorkflowListProps) {
  const { urls } = NamedRoutes.use()
  // TODO: cards
  return (
    <>
      <M.Typography variant="body1">Workflows</M.Typography>
      <M.List>
        {config.workflows.map((workflow) => {
          if (typeof workflow.slug !== 'string') return null
          return (
            <M.ListItem
              key={workflow.slug}
              button
              component={ListItemLink}
              to={urls.bucketWorkflowDetail(bucket, workflow.slug)}
            >
              <M.ListItemText
                primary={workflow.name || workflow.slug}
                secondary={workflow.description}
              />
            </M.ListItem>
          )
        })}
      </M.List>
    </>
  )
}
