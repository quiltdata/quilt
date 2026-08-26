import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as authSelectors from 'containers/Auth/selectors'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as BucketPreferences from 'utils/BucketPreferences'
import { Plural } from 'utils/format'
import { formatQuantity } from 'utils/string'

import * as PD from './PackageDialog'
import { useTabulatorTables } from './Tabulator/requests'
import { useStats, type StatsData } from './Overview/useStats'

const useStatsItemStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    display: 'flex',
  },
  label: {
    color: 'inherit',
    fontSize: t.typography.h6.fontSize,
    lineHeight: `${t.spacing(4)}px`,
    marginLeft: t.spacing(1),
  },
  value: {
    color: 'inherit',
    fontSize: t.typography.h6.fontSize,
    fontWeight: t.typography.fontWeightBold,
    letterSpacing: 0,
    lineHeight: `${t.spacing(4)}px`,
  },
}))

interface StatsItemProps {
  label?: React.ReactNode
  value: React.ReactNode
  to?: string
}

function StatsItem({ label, value, to }: StatsItemProps) {
  const classes = useStatsItemStyles()
  const content = (
    <>
      <span className={classes.value}>{value}</span>
      {!!label && <span className={classes.label}>{label}</span>}
    </>
  )
  if (to) {
    return (
      <StyledLink className={classes.root} to={to}>
        {content}
      </StyledLink>
    )
  }
  return <span className={classes.root}>{content}</span>
}

const useStatsItemSkeletonStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(4),
  },
  skeleton: {
    borderRadius: t.shape.borderRadius,
    height: t.typography.h6.fontSize,
    width: t.spacing(12),
  },
}))

function StatsItemSkeleton() {
  const classes = useStatsItemSkeletonStyles()
  return (
    <div className={classes.root}>
      <Skeleton className={classes.skeleton} bgcolor="grey.400" />
    </div>
  )
}

function TabulatorItemWrapper({ bucket }: { bucket: string }) {
  const { urls } = NamedRoutes.use()
  const result = useTabulatorTables(bucket)
  switch (result._tag) {
    case 'fetching':
      return <StatsItemSkeleton />
    case 'ready':
      return result.tables.length > 0 ? (
        <StatsItem
          value={formatQuantity(result.tables.length)}
          label={<Plural value={result.tables.length} one="table" other="tables" />}
          to={urls.queriesAthena({ bucket })}
        />
      ) : null
    default:
      return null
  }
}

const useStatsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    columnGap: t.spacing(3),
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    rowGap: t.spacing(1),
  },
}))

interface StatsProps {
  bucket: string
  stats: StatsData
}

function Stats({ bucket, stats }: StatsProps) {
  const classes = useStatsStyles()
  const { urls } = NamedRoutes.use()
  const { prefs } = BucketPreferences.use()
  const { totalBytes, totalObjects, numObjects, pkgCount, numPackages } = stats
  // The tables stat links into the global Athena console (scoped to this
  // bucket) — hide it (and skip its query) for buckets that de-emphasized
  // queries via `ui.nav.queries`.
  const queriesEnabled = BucketPreferences.Result.match(
    { Ok: ({ ui: { nav } }) => nav.queries, _: () => false },
    prefs,
  )
  return (
    <div className={classes.root}>
      {totalBytes ? <StatsItem value={totalBytes} /> : <StatsItemSkeleton />}
      {totalObjects ? (
        <StatsItem
          value={totalObjects}
          label={<Plural value={numObjects ?? 0} one="object" other="objects" />}
          to={urls.bucketDir(bucket)}
        />
      ) : (
        <StatsItemSkeleton />
      )}
      {pkgCount ? (
        <StatsItem
          value={pkgCount}
          label={<Plural value={numPackages ?? 0} one="package" other="packages" />}
          to={urls.bucketPackageList(bucket)}
        />
      ) : (
        <StatsItemSkeleton />
      )}
      {queriesEnabled && <TabulatorItemWrapper bucket={bucket} />}
      <CreatePackage bucket={bucket} />
    </div>
  )
}

interface CreatePackageProps {
  bucket: string
}

function CreatePackage({ bucket }: CreatePackageProps) {
  const dst = React.useMemo(() => ({ bucket }), [bucket])
  const createDialog = PD.useCreateDialog({
    dst,
    delayHashing: true,
    disableStateDisplay: true,
  })
  return (
    <>
      <M.Button color="primary" variant="contained" onClick={() => createDialog.open()}>
        Create package
      </M.Button>
      {createDialog.render({
        title: 'Create package',
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
      })}
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  // Three explicit tiers instead of emergent wrapping. Wide: one calm grid row
  // (title | readouts | settings) where the readout strip never wraps — the
  // title truncates instead. Medium (≤1000px): title + settings on row one, the
  // readout strip full-width beneath. Narrow (≤640px): readouts in a compact
  // two-column grid, the action full-width below.
  root: {
    alignItems: 'center',
    columnGap: t.spacing(3),
    display: 'grid',
    gridTemplateAreas: '"title stats settings"',
    gridTemplateColumns: 'minmax(140px, 1fr) auto auto',
    '@media (max-width: 1000px)': {
      gridTemplateAreas: '"title settings" "stats stats"',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      rowGap: t.spacing(1),
    },
  },
  title: {
    gridArea: 'title',
    minWidth: 0,
    overflow: 'hidden',
  },
  stats: {
    gridArea: 'stats',
    minWidth: 0,
    // Reaches into Stats' own row to retune its distribution per tier:
    // one line when wide, left-aligned wrap with the action pushed to the
    // row's end at medium, a two-column readout grid when narrow.
    '& > div': {
      flexWrap: 'nowrap',
      '@media (max-width: 1000px)': {
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        '& > button': {
          marginLeft: 'auto',
        },
      },
      '@media (max-width: 640px)': {
        columnGap: t.spacing(3),
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        rowGap: t.spacing(1),
        '& > button': {
          gridColumn: '1 / -1',
          marginLeft: 0,
        },
      },
    },
  },
  // Settings sits at the card's far edge behind a hairline divider — config
  // set apart from the bucket's readout, muted until hovered.
  settings: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderLeft: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'flex',
    gridArea: 'settings',
    paddingLeft: t.spacing(2),
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
}))

interface HeaderProps {
  bucket: string
}

// The bucket header (name + settings + stats + create-package) shown above the
// bucket tabs, so it stays visible across all tabs (not just Overview).
export default function Header({ bucket }: HeaderProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const isAdmin = redux.useSelector(authSelectors.isAdmin)
  const stats = useStats(bucket)
  return (
    <div className={classes.root}>
      <div className={classes.title}>
        <M.Typography variant="h5" noWrap title={bucket}>
          {bucket}
        </M.Typography>
      </div>
      <div className={classes.stats}>
        <Stats bucket={bucket} stats={stats} />
      </div>
      {isAdmin && (
        <RRDom.Link className={classes.settings} to={urls.adminBucketEdit(bucket)}>
          <M.Tooltip arrow title="Bucket settings">
            <M.IconButton size="small" color="inherit">
              <M.Icon fontSize="small">settings</M.Icon>
            </M.IconButton>
          </M.Tooltip>
        </RRDom.Link>
      )}
    </div>
  )
}
