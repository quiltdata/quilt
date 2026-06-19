import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import * as BucketPreferences from 'utils/BucketPreferences'
import { Plural } from 'utils/format'
import { readableBytes, readableQuantity, formatQuantity } from 'utils/string'
import useConst from 'utils/useConstant'

import * as PD from '../../PackageDialog'
import * as requests from '../../requests'
import { useTabulatorTables } from '../../Tabulator/requests'

import { makeColorPool } from '../ColorPool'
import ObjectsByExt, { COLOR_MAP } from '../ObjectsByExt'

import BUCKET_QUERY from '../gql/Bucket.generated'
import STAT_COUNTS_QUERY from '../gql/StatCounts.generated'

import Readme from './Readme'
import RecentPackages from './RecentPackages'

// NOTE: replicated from legacy Overview/Header `useStats` (not exported there);
// keep in sync — both read the same `bucketStats` request + StatCounts query.
function useStats(bucket: string) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const statsData = useData(requests.bucketStats, { req, s3, bucket })
  const countQuery = GQL.useQuery(STAT_COUNTS_QUERY, { buckets: [bucket] })
  const totalBytes: string | null = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => readableBytes(v.totalBytes),
          Err: () => '? B',
          _: () => null,
        },
        statsData.result,
      ),
    [statsData.result],
  )
  const totalObjects: string | null = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => readableQuantity(v.totalObjects),
          Err: () => '?',
          _: () => null,
        },
        statsData.result,
      ),
    [statsData.result],
  )
  // Raw object count, kept alongside the formatted `totalObjects` to pluralize its label.
  const numObjects: number | null = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => v.totalObjects,
          _: () => null,
        },
        statsData.result,
      ),
    [statsData.result],
  )
  const pkgCount: string | null = React.useMemo(
    () =>
      GQL.fold(countQuery, {
        data: ({ searchPackages: r }) => {
          switch (r.__typename) {
            case 'EmptySearchResultSet':
              return formatQuantity(0)
            case 'InvalidInput':
            case 'OperationError':
              return '?'
            case 'PackagesSearchResultSet':
              // `-1` == secure search
              return r.total >= 0 ? formatQuantity(r.total) : '?'
            default:
              assertNever(r)
          }
        },
        fetching: () => null,
        error: () => '?',
      }),
    [countQuery],
  )
  // Raw package count, kept alongside the formatted `pkgCount` to pluralize its label.
  const numPackages: number | null = React.useMemo(
    () =>
      GQL.fold(countQuery, {
        data: ({ searchPackages: r }) => {
          switch (r.__typename) {
            case 'EmptySearchResultSet':
              return 0
            case 'InvalidInput':
            case 'OperationError':
              return null
            case 'PackagesSearchResultSet':
              // `-1` == secure search
              return r.total >= 0 ? r.total : null
            default:
              return assertNever(r)
          }
        },
        fetching: () => null,
        error: () => null,
      }),
    [countQuery],
  )
  return {
    totalBytes,
    totalObjects,
    numObjects,
    pkgCount,
    numPackages,
    statsResult: statsData.result,
  }
}

const useStatsItemStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    display: 'flex',
  },
  label: {
    color: 'inherit',
    fontSize: t.typography.h6.fontSize,
    lineHeight: '32px',
    marginLeft: t.spacing(1),
  },
  value: {
    color: 'inherit',
    fontSize: t.typography.h6.fontSize,
    fontWeight: t.typography.fontWeightBold,
    letterSpacing: 0,
    lineHeight: '32px',
  },
}))

interface StatsItemProps {
  label?: React.ReactNode
  value: string
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
    height: 32,
  },
  skeleton: {
    borderRadius: t.shape.borderRadius,
    height: t.typography.h6.fontSize,
    width: 96,
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

const useStatsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(4),
    justifyContent: 'flex-end',
  },
}))

type StatsData = ReturnType<typeof useStats>

interface StatsProps {
  bucket: string
  stats: StatsData
}

function Stats({ bucket, stats }: StatsProps) {
  const classes = useStatsStyles()
  const { urls } = NamedRoutes.use()
  const { prefs } = BucketPreferences.use()
  const { totalBytes, totalObjects, numObjects, pkgCount, numPackages } = stats
  const tables = useTabulatorTables(bucket)
  // The tables stat links into the Queries tab — hide it for buckets that
  // disabled Queries via `ui.nav.queries`.
  const queriesEnabled = BucketPreferences.Result.match(
    { Ok: ({ ui: { nav } }) => nav.queries, _: () => false },
    prefs,
  )
  const numTables = queriesEnabled && Array.isArray(tables) ? tables.length : null
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
      {!!numTables && (
        <StatsItem
          value={formatQuantity(numTables)}
          label={<Plural value={numTables} one="table" other="tables" />}
          to={urls.bucketQueries(bucket)}
        />
      )}
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

const useChartsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    marginTop: t.spacing(3),
    position: 'relative',
    [t.breakpoints.up('md')]: {
      flexDirection: 'row',
    },
  },
  // Match SectionHeader (the "Latest packages" heading) so both columns start
  // their content at the same vertical offset.
  objectsHeading: {
    ...t.typography.subtitle1,
    alignItems: 'center',
    display: 'flex',
    fontWeight: t.typography.fontWeightMedium,
    minHeight: 32,
  },
  divider: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: 32,
    justifyContent: 'center',
    width: '100%',
    [t.breakpoints.up('md')]: {
      height: '100%',
      width: 32,
    },
  },
}))

interface ChartsProps {
  bucket: string
  statsResult: StatsData['statsResult']
}

function Charts({ bucket, statsResult }: ChartsProps) {
  const classes = useChartsStyles()
  const colorPool = useConst(() => makeColorPool(COLOR_MAP))
  return (
    <div className={classes.root}>
      <ObjectsByExt
        data={AsyncResult.prop('exts', statsResult)}
        width="100%"
        flexShrink={1}
        colorPool={colorPool}
        heading="Objects by file extension"
        headingClassName={classes.objectsHeading}
      />
      <div className={classes.divider}>
        <M.Hidden mdUp>
          <M.Divider />
        </M.Hidden>
      </div>
      <RecentPackages bucket={bucket} />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
  },
  top: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    [t.breakpoints.up('sm')]: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  },
  title: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 1,
    minWidth: 0,
  },
  settings: {
    marginLeft: t.spacing(1),
  },
  description: {
    marginTop: t.spacing(2),
  },
  readme: {
    marginTop: t.spacing(2),
  },
  divider: {
    marginTop: t.spacing(3),
  },
}))

interface HeaderProps {
  bucket: string
}

export default function Header({ bucket }: HeaderProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const isAdmin = redux.useSelector(authSelectors.isAdmin)
  const { bucket: bucketData } = GQL.useQueryS(BUCKET_QUERY, { bucket })
  const description = bucketData?.description
  const stats = useStats(bucket)
  return (
    <M.Paper className={classes.root}>
      <div className={classes.top}>
        <div className={classes.title}>
          <M.Typography variant="h5">{bucket}</M.Typography>
          {isAdmin && (
            <RRLink className={classes.settings} to={urls.adminBucketEdit(bucket)}>
              <M.IconButton size="small" color="inherit">
                <M.Icon>settings</M.Icon>
              </M.IconButton>
            </RRLink>
          )}
        </div>
        <Stats bucket={bucket} stats={stats} />
      </div>
      {!!description && (
        <M.Typography className={classes.description} variant="body1">
          {description}
        </M.Typography>
      )}
      <div className={classes.readme}>
        <Readme bucket={bucket} />
      </div>
      <M.Divider className={classes.divider} />
      <Charts bucket={bucket} statsResult={stats.statsResult} />
    </M.Paper>
  )
}
