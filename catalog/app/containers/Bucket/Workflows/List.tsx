import cx from 'classnames'
import * as Eff from 'effect'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
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
          return !r.total ? (
            <span className={classes.root}>No packages</span>
          ) : (
            <RR.Link
              to={search.makeUrl(bucket, workflow as string)}
              className={cx(classes.root, classes.link)}
            >
              {r.total} packages
            </RR.Link>
          )
        case 'InvalidInput':
        case 'OperationError':
          const tip =
            r.__typename === 'OperationError'
              ? r.name
              : `Invalid input: ${r.errors[0].message}`
          return (
            <M.Tooltip arrow title={tip}>
              <span className={classes.root}>? packages</span>
            </M.Tooltip>
          )
        default:
          return Eff.absurd<never>(r)
      }
    },
    fetching: () => (
      <div className={classes.root}>
        <Skeleton animate height={22} width="8rem" />
      </div>
    ),
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
  schemas: {
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
  link: {
    ...t.typography.body1,
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
    fontWeight: t.typography.fontWeightLight,
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

  return (
    <M.Paper className={classes.root} variant="outlined">
      <div className={classes.inner}>
        {workflow.isDefault && (
          <M.Chip
            className={classes.chip}
            label="Default"
            size="small"
            variant="outlined"
          />
        )}

        {workflow.isDisabled && (
          <M.Chip className={classes.chip} label="Disabled" size="small" />
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
      </div>

      {(!!workflow.schemas.metadata || !!workflow.schemas.entries) && (
        <div className={classes.schemas}>
          <SchemaLink label="Metadata Schema" schema={workflow.schemas.metadata} />
          <SchemaLink label="Entries Schema" schema={workflow.schemas.entries} />
        </div>
      )}

      <PackagesLink bucket={bucket} workflow={workflow.slug as string} />
    </M.Paper>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(4),
    marginTop: t.spacing(3),
  },
  heading: {
    ...t.typography.h5,
    marginBottom: t.spacing(3),
  },
  grid: {
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(3, 1fr)',

    [t.breakpoints.down(1100)]: {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },

    [t.breakpoints.down(700)]: {
      gridTemplateColumns: '1fr',
    },
  },
}))

interface WorkflowListProps {
  bucket: string
  workflows: Workflows.Workflow[]
}

export default function WorkflowList({ bucket, workflows }: WorkflowListProps) {
  const classes = useStyles()

  return (
    <div className={classes.grid}>
      {workflows.map((workflow) => (
        <WorkflowCard key={workflow.slug as string} bucket={bucket} workflow={workflow} />
      ))}
    </div>
  )
}
