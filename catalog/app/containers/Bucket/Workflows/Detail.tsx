import * as Eff from 'effect'
import cx from 'classnames'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Column from 'components/Layout/Column'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Format from 'utils/format'
import StyledLink from 'utils/StyledLink'
import { readableBytes } from 'utils/string'
import * as Workflows from 'utils/workflows'

import { useCreateDialog } from '../PackageDialog/Create'

import * as Health from './Health'
import * as search from './search'

import PACKAGES_QUERY from './gql/WorkflowPackages.generated'

type SearchPackages = Extract<
  GQL.DataForDoc<typeof PACKAGES_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>

type Package = Extract<
  SearchPackages['firstPage'],
  { __typename: 'PackagesSearchResultSetPage' }
>['hits'][0]

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
    gridTemplateColumns: '1fr',
    marginBottom: t.spacing(2),

    [Column.up(1100)]: {
      gridTemplateColumns: '1fr 1fr',
    },
  },
}))

interface PackagesProps {
  bucket: string
  workflow: string
}

function CreatePackage({ bucket }: { bucket: string }) {
  const dst = React.useMemo(() => ({ bucket }), [bucket])
  const createDialog = useCreateDialog({
    delayHashing: true,
    disableStateDisplay: true,
    dst,
  })
  return (
    <>
      <M.Button color="primary" onClick={() => createDialog.open()} variant="contained">
        Create package
      </M.Button>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => <>Package {packageLink} created</>,
        title: 'Create package',
      })}
    </>
  )
}

const useEmptyStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(2),
    padding: t.spacing(1, 0),
  },
  text: { flex: '1 1 20rem', minWidth: 0 },
  code: {
    background: t.palette.action.hover,
    borderRadius: t.shape.borderRadius,
    display: 'block',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    marginTop: t.spacing(1),
    overflowWrap: 'anywhere',
    padding: t.spacing(1),
  },
}))

function NoPackages({ bucket, workflow }: PackagesProps) {
  const classes = useEmptyStyles()
  return (
    <div className={classes.root}>
      <div className={classes.text}>
        <M.Typography variant="body1">No packages use this flow yet</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Pick it when you create a package, or push from Python:
        </M.Typography>
        <code className={classes.code}>
          {`quilt3.Package().push("team/name", registry="s3://${bucket}", workflow="${workflow}")`}
        </code>
      </div>
      <CreatePackage bucket={bucket} />
    </div>
  )
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
          return <NoPackages bucket={bucket} workflow={workflow} />
        case 'PackagesSearchResultSet':
          const { firstPage, total } = d.searchPackages
          const hits =
            firstPage.__typename === 'PackagesSearchResultSetPage' ? firstPage.hits : []
          if (!hits.length) return <NoPackages bucket={bucket} workflow={workflow} />
          return (
            <>
              <div className={classes.grid}>
                {hits.map((pkg) => (
                  <PackageCard key={pkg.id} bucket={bucket} pkg={pkg} />
                ))}
              </div>
              <M.Button
                variant="outlined"
                color="primary"
                component={RR.Link}
                to={searchUrl}
              >
                See all {total} packages
              </M.Button>
            </>
          )
        case 'InvalidInput':
          return (
            <M.Typography color="error">
              Packages for this flow can&apos;t be searched right now.
            </M.Typography>
          )
        case 'OperationError':
          return <M.Typography color="error">{d.searchPackages.message}</M.Typography>
        default:
          return Eff.absurd<never>(d.searchPackages)
      }
    },
    fetching: () => <M.CircularProgress size={24} />,
  })
}

const useActionsStyles = M.makeStyles((t) => ({
  row: {
    alignItems: 'center',
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    gap: t.spacing(1.5),
    marginTop: t.spacing(1),
    padding: t.spacing(1.5),
  },
  icon: {
    background: M.fade(t.palette.info.main, 0.12),
    borderRadius: t.shape.borderRadius,
    color: t.palette.info.dark,
    flex: 'none',
    padding: t.spacing(0.5),
  },
  planned: {
    background: t.palette.action.hover,
    color: t.palette.text.disabled,
  },
  text: { flexGrow: 1, minWidth: 0 },
  mono: { fontFamily: t.typography.monospace.fontFamily, overflowWrap: 'anywhere' },
  add: { marginTop: t.spacing(1) },
}))

interface ActionsProps {
  successors: Workflows.Successor[]
  onEdit?: () => void
}

// Promote is the flow's live action today: the bucket's promote targets.
// ponytail: promote targets are bucket-wide in config.yml; per-flow actions need the
// registry store in 05-flows.md (a Decision Board item).
function Actions({ successors, onEdit }: ActionsProps) {
  const classes = useActionsStyles()
  return (
    <>
      {successors.map((s) => (
        <div key={s.url} className={classes.row}>
          <M.Icon className={classes.icon}>north_east</M.Icon>
          <div className={classes.text}>
            <M.Typography variant="body2">
              <strong>Promote to {s.name}</strong>
            </M.Typography>
            <M.Typography variant="caption" color="textSecondary">
              Offered on every package in this bucket: copy it to{' '}
              <span className={classes.mono}>{s.url}</span>
              {s.copyData ? ' with its data' : ''}
            </M.Typography>
          </div>
        </div>
      ))}
      <div className={classes.row}>
        <M.Icon className={cx(classes.icon, classes.planned)}>notifications</M.Icon>
        <div className={classes.text}>
          <M.Typography variant="body2" color="textSecondary">
            Notify a channel when a package passes
          </M.Typography>
          <M.Typography variant="caption" color="textSecondary">
            Planned
          </M.Typography>
        </div>
      </div>
      {onEdit && (
        <M.Button
          className={classes.add}
          color="primary"
          onClick={onEdit}
          size="small"
          startIcon={<M.Icon>add</M.Icon>}
        >
          {successors.length ? 'Change promote targets' : 'Add a promote target'}
        </M.Button>
      )}
    </>
  )
}

const useDetailStyles = M.makeStyles((t) => ({
  lede: {
    maxWidth: '72ch',
  },
  meta: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5, 2),
    marginTop: t.spacing(1),
  },
  metaItem: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: t.spacing(0.5),
  },
  mono: { fontFamily: t.typography.monospace.fontFamily },
  grid: {
    display: 'grid',
    gap: t.spacing(3),
    gridTemplateColumns: 'minmax(0, 1fr)',
    [t.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  },
  wide: {
    marginTop: t.spacing(3),
  },
}))

interface WorkflowDetailProps {
  bucket: string
  workflow: Workflows.Workflow
  successors: Workflows.Successor[]
  onEdit?: () => void
}

export default function WorkflowDetail({
  bucket,
  workflow,
  successors,
  onEdit,
}: WorkflowDetailProps) {
  const classes = useDetailStyles()
  const metadataSchema = Health.useSchema(workflow.schema?.url)
  const entriesSchema = Health.useSchema(workflow.entriesSchema)
  const slug = workflow.slug as string

  return (
    <>
      <M.Typography className={classes.lede} variant="body1" color="textSecondary">
        {workflow.description || (
          <>
            No description yet. Add one so people know when to pick this flow.{' '}
            {onEdit && <StyledLink onClick={onEdit}>Add description</StyledLink>}
          </>
        )}
      </M.Typography>
      <div className={classes.meta}>
        <span className={classes.metaItem}>
          <M.Icon fontSize="small">tag</M.Icon>
          <span className={classes.mono}>{slug}</span>
        </span>
        {workflow.isMessageRequired && (
          <span className={classes.metaItem}>
            <M.Icon fontSize="small">chat_bubble_outline</M.Icon>
            Message required
          </span>
        )}
      </div>

      <Health.Status
        workflow={workflow}
        metadataSchema={metadataSchema}
        entriesSchema={entriesSchema}
        onEdit={onEdit}
      />

      <div className={classes.grid}>
        <Health.Card icon="rule" title="Rules" hint="Checked on every push">
          <Health.Rules workflow={workflow} metadataSchema={metadataSchema} />
        </Health.Card>
        <Health.Card icon="bolt" title="Actions" hint="What packages can do next">
          <Actions successors={successors} onEdit={onEdit} />
        </Health.Card>
      </div>

      <Health.Card
        className={classes.wide}
        icon="science"
        title="Try it"
        hint="Nothing is pushed"
      >
        <Health.TryIt
          workflow={workflow}
          metadataSchema={metadataSchema}
          entriesSchema={entriesSchema}
        />
      </Health.Card>

      <Health.Card className={classes.wide} icon="inventory_2" title="Recent packages">
        <Packages bucket={bucket} workflow={slug} />
      </Health.Card>
    </>
  )
}
