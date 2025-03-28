import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Workflows from 'utils/workflows'

interface WorkflowCardProps {
  bucket: string
  workflow: Workflows.Workflow
}

function WorkflowCard({ bucket, workflow }: WorkflowCardProps) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Card>
      <M.CardContent>
        <M.Typography variant="body1" gutterBottom>
          <RR.Link to={urls.bucketWorkflowDetail(bucket, workflow.slug)}>
            {workflow.name}
          </RR.Link>
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary" gutterBottom>
          {workflow.description}
        </M.Typography>
        <M.Box pt={2} />
        <M.Typography variant="body2" gutterBottom>
          <RR.Link to={urls.bucketWorkflowDetail(bucket, workflow.slug)}>
            123 Packages
          </RR.Link>
        </M.Typography>
        <M.Box pt={2} />
        <JsonDisplay value={workflow} />
      </M.CardContent>
    </M.Card>
  )
}

const useStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(3, 1fr)',
  },
}))

interface WorkflowListProps {
  bucket: string
  config: Workflows.WorkflowsConfig
}

export default function WorkflowList({ bucket, config }: WorkflowListProps) {
  const classes = useStyles()

  const workflows = React.useMemo(
    () => config.workflows.filter((w) => !w.isDisabled && typeof w.slug === 'string'),
    [config.workflows],
  )

  return (
    <>
      <M.Box py={3}>
        <M.Typography variant="h5">Workflows</M.Typography>
      </M.Box>
      <div className={classes.grid}>
        {workflows.map((workflow) => (
          <WorkflowCard
            key={workflow.slug as string}
            bucket={bucket}
            workflow={workflow}
          />
        ))}
      </div>
    </>
  )
}
