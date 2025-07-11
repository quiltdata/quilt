import * as Eff from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as Format from 'utils/format'
import { readableBytes } from 'utils/string'
import * as Workflows from 'utils/workflows'

import * as search from './search'

import PACKAGES_QUERY from './gql/WorkflowPackages.generated'

type SearchPackages = Extract<
  GQL.DataForDoc<typeof PACKAGES_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>

type Package = SearchPackages['firstPage']['hits'][0]

const usePackageCardStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  inner: {
    flexGrow: 1,
    padding: t.spacing(2),
    position: 'relative',
  },
  link: {
    ...t.typography.body1,
    lineHeight: '20px',
  },
  linkText: {
    position: 'relative',
  },
  linkClickArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,

    '$link:hover &': {
      background: t.palette.action.hover,
    },
  },
  secondary: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
  divider: {
    marginLeft: t.spacing(0.5),
    marginRight: t.spacing(0.5),
  },
  comment: {
    ...t.typography.body2,
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
}))

interface PackageCardProps {
  bucket: string
  pkg: Package
}

function PackageCard({ bucket, pkg }: PackageCardProps) {
  const classes = usePackageCardStyles()
  const { urls } = NamedRoutes.use()
  // XXX: selective metadata display (like in package list)
  return (
    <M.Paper className={classes.root} variant="outlined">
      <div className={classes.inner}>
        <RR.Link className={classes.link} to={urls.bucketPackageDetail(bucket, pkg.name)}>
          <span className={classes.linkText}>{pkg.name}</span>
          <div className={classes.linkClickArea} />
        </RR.Link>
        <div className={classes.secondary}>
          {readableBytes(pkg.size)}
          <span className={classes.divider}> • </span>
          Updated <Format.Relative value={pkg.modified} />
        </div>
      </div>
      {!!pkg.comment && <div className={classes.comment}>{pkg.comment}</div>}
    </M.Paper>
  )
}

const usePackagesStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: '1fr 1fr',
    marginBottom: t.spacing(2),

    [t.breakpoints.down(1100)]: {
      gridTemplateColumns: '1fr',
    },
  },
}))

interface PackagesProps {
  bucket: string
  workflow: string
}

function Packages({ bucket, workflow }: PackagesProps) {
  const classes = usePackagesStyles()

  const buckets = React.useMemo(() => [bucket], [bucket])
  const filter = React.useMemo(
    () => ({ workflow: { terms: [workflow] } }) as any,
    [workflow],
  )

  const query = GQL.useQuery(PACKAGES_QUERY, { buckets, filter })

  const searchUrl = search.makeUrl(bucket, workflow)

  return GQL.fold(query, {
    data: (d) => {
      switch (d.searchPackages.__typename) {
        case 'EmptySearchResultSet':
          return <M.Typography>No packages found for this workflow</M.Typography>
        case 'PackagesSearchResultSet':
          const { firstPage, total } = d.searchPackages
          return (
            <>
              <div className={classes.grid}>
                {firstPage.hits.map((pkg) => (
                  <PackageCard key={pkg.id} bucket={bucket} pkg={pkg} />
                ))}
              </div>

              <M.Button
                variant="outlined"
                color="primary"
                component={RR.Link}
                to={searchUrl}
              >
                Explore {total} packages
              </M.Button>
            </>
          )
        case 'InvalidInput':
          return <M.Typography>Error: Invalid input</M.Typography>
        default:
          return Eff.absurd<never>(d.searchPackages)
      }
    },
    fetching: () => <M.CircularProgress />,
  })
}

interface SchemaLinkProps {
  label: React.ReactNode
  schema?: Workflows.SchemaRef
}

function SchemaLink({ label, schema }: SchemaLinkProps) {
  const { urls } = NamedRoutes.use()

  if (!schema) return null

  const l = schema.location
  const to = urls.bucketFile(l.bucket, l.key, { version: l.version })

  return (
    <M.Typography variant="body2">
      {label}: <StyledLink to={to}>{schema.name}</StyledLink>
    </M.Typography>
  )
}

interface WorkflowDetailProps {
  bucket: string
  workflow: Workflows.Workflow
}

export default function WorkflowDetail({ bucket, workflow }: WorkflowDetailProps) {
  return (
    <>
      <M.Typography variant="body1" gutterBottom>
        {workflow.name}
      </M.Typography>

      <M.Typography variant="body2" color="textSecondary" gutterBottom>
        {workflow.description}
      </M.Typography>

      {(!!workflow.schemas.metadata || !!workflow.schemas.entries) && (
        <M.Box pt={2}>
          <SchemaLink label="Metadata Schema" schema={workflow.schemas.metadata} />
          <SchemaLink label="Entries Schema" schema={workflow.schemas.entries} />
        </M.Box>
      )}

      <M.Box mt={3} mb={2}>
        <M.Typography variant="h5">Recent Packages</M.Typography>
      </M.Box>
      <Packages bucket={bucket} workflow={workflow.slug as string} />
    </>
  )
}
