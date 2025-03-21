import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Workflows from 'utils/workflows'

import * as search from './search'
import PACKAGE_COUNT_QUERY from './gql/WorkflowPackageCount.generated'

const usePackagesLinkStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.subtitle2,
    borderTop: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'block',
    padding: t.spacing(2),
  },
  link: {
    '&:hover': {
      background: t.palette.action.hover,
      color: t.palette.text.primary,
    },
  },
}))

interface PackagesLinkProps {
  bucket: string
  workflow: string
}

function PackagesLink({ bucket, workflow }: PackagesLinkProps) {
  const classes = usePackagesLinkStyles()

  const buckets = React.useMemo(() => [bucket], [bucket])
  const filter = React.useMemo(
    () => ({ workflow: { terms: [workflow] } }) as any,
    [workflow],
  )
  const query = GQL.useQuery(PACKAGE_COUNT_QUERY, { buckets, filter })

  return GQL.fold(query, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return <span className={classes.root}>No packages</span>
        case 'PackagesSearchResultSet':
          return (
            <RR.Link
              to={search.makeUrl(bucket, workflow as string)}
              className={cx(classes.root, classes.link)}
            >
              {r.stats.total} packages
            </RR.Link>
          )
        case 'InvalidInput':
          return (
            <M.Tooltip arrow title={`Invalid input: ${r.errors[0].message}`}>
              <span className={classes.root}>? packages</span>
            </M.Tooltip>
          )
        default:
          return Eff.absurd<never>(r)
      }
    },
    fetching: () => (
      <Skeleton className={classes.root} animate height={24} width="8rem" />
    ),
  })
}

const useCardStyles = M.makeStyles((t) => ({
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
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: '20px',
  },
  linkText: {
    position: 'relative',

    '&$disabled': {
      color: t.palette.text.disabled,
    },
  },
  disabled: {},
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
  name: {
    ...t.typography.body2,
    marginTop: t.spacing(1),
  },
  description: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
  chip: {
    float: 'right',
    marginLeft: t.spacing(1),
  },
}))

interface WorkflowCardProps {
  bucket: string
  workflow: Workflows.Workflow
}

function WorkflowCard({ bucket, workflow }: WorkflowCardProps) {
  const classes = useCardStyles()
  const { urls } = NamedRoutes.use()
  // TODO: show schema names with links to schema files in quilt

  return (
    <M.Paper className={classes.root}>
      <div className={classes.inner}>
        {workflow.isDefault && (
          <M.Chip size="small" label="Default" className={classes.chip} />
        )}

        {workflow.isDisabled && (
          <M.Chip
            size="small"
            label="Disabled"
            variant="outlined"
            className={classes.chip}
          />
        )}

        <RR.Link
          className={classes.link}
          to={urls.bucketWorkflowDetail(bucket, workflow.slug)}
        >
          <span className={cx(classes.linkText, workflow.isDisabled && classes.disabled)}>
            {workflow.slug}
          </span>
          <div className={classes.linkClickArea} />
        </RR.Link>

        <div className={classes.name}>{workflow.name}</div>

        <p className={classes.description}>{workflow.description}</p>

        {!!workflow.schema && (
          <M.Typography variant="caption" color="textSecondary">
            Metadata Schema: {workflow.schema.url}
          </M.Typography>
        )}

        {!!workflow.entriesSchema && (
          <M.Typography variant="caption" color="textSecondary">
            Entries Schema: {workflow.entriesSchema}
          </M.Typography>
        )}
      </div>
      <PackagesLink bucket={bucket} workflow={workflow.slug as string} />
    </M.Paper>
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
