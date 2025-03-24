import * as Eff from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as workflows from 'utils/workflows'

// import * as search from './search'

import PACKAGES_QUERY from './gql/WorkflowPackages.generated'

const usePackageStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(3, 1fr)',
  },
}))

interface PackagesProps {
  bucket: string
  workflow: string
}

function Packages({ bucket, workflow }: PackagesProps) {
  const classes = usePackageStyles()
  const { urls } = NamedRoutes.use()

  const buckets = React.useMemo(() => [bucket], [bucket])
  const filter = React.useMemo(
    () => ({ workflow: { terms: [workflow] } }) as any,
    [workflow],
  )

  const query = GQL.useQuery(PACKAGES_QUERY, { buckets, filter })

  // TODO: link to search
  return (
    <div>
      {GQL.fold(query, {
        data: (d) => {
          switch (d.searchPackages.__typename) {
            case 'EmptySearchResultSet':
              return <M.Typography>No packages found for this workflow</M.Typography>
            case 'PackagesSearchResultSet':
              const { firstPage, stats } = d.searchPackages
              return (
                <>
                  <div className={classes.grid}>
                    {firstPage.hits.map((pkg) => (
                      <M.Card key={pkg.id}>
                        <M.CardContent>
                          <RR.Link to={urls.bucketPackageDetail(bucket, pkg.name)}>
                            <M.Typography>{pkg.name}</M.Typography>
                          </RR.Link>
                        </M.CardContent>
                      </M.Card>
                    ))}
                  </div>

                  <M.Box pt={2} />
                  <M.Typography variant="body2">
                    {/* TODO: link to pre-filled search */}
                    Explore {stats.total} packages
                  </M.Typography>
                </>
              )
            case 'InvalidInput':
              return <M.Typography>Error: Invalid input</M.Typography>
            default:
              Eff.absurd(d.searchPackages)
          }
        },
        fetching: () => <M.CircularProgress />,
      })}
    </div>
  )
}

interface WorkflowDetailProps {
  bucket: string
  workflow: workflows.Workflow
}

export default function WorkflowDetail({ bucket, workflow }: WorkflowDetailProps) {
  return (
    <>
      <M.Typography variant="body2" color="textSecondary" gutterBottom>
        {workflow.description}
      </M.Typography>

      <M.Box pt={2} />
      <JsonDisplay value={workflow} />

      <M.Box pt={4} />
      <M.Typography variant="h6" gutterBottom>
        Most Recent Packages
      </M.Typography>
      <Packages bucket={bucket} workflow={workflow.slug as string} />
    </>
  )
}
