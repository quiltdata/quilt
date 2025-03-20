import * as Eff from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import JsonDisplay from 'components/JsonDisplay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Workflows from 'utils/workflows'

import * as search from './search'
import PACKAGE_COUNT_QUERY from './gql/WorkflowPackageCount.generated'

interface WorkflowCardProps {
  bucket: string
  workflow: Workflows.Workflow
}

function WorkflowCard({ bucket, workflow }: WorkflowCardProps) {
  const { urls } = NamedRoutes.use()
  const buckets = React.useMemo(() => [bucket], [bucket])
  const filter = React.useMemo(
    () => ({ workflow: { terms: [workflow.slug] } }) as any,
    [workflow],
  )
  const query = GQL.useQuery(PACKAGE_COUNT_QUERY, { buckets, filter })
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

        {GQL.fold(query, {
          data: (d) => {
            switch (d.searchPackages.__typename) {
              case 'EmptySearchResultSet':
                return <M.Typography>No packages</M.Typography>
              case 'PackagesSearchResultSet':
                const { total } = d.searchPackages.stats
                return (
                  <M.Typography variant="body2" gutterBottom>
                    <RR.Link to={search.makeUrl(bucket, workflow.slug as string)}>
                      {total} packages
                    </RR.Link>
                  </M.Typography>
                )
              case 'InvalidInput':
                return <M.Typography>Error: Invalid input</M.Typography>
              default:
                Eff.absurd(d.searchPackages)
            }
          },
          fetching: () => <>skeleton</>,
        })}

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
