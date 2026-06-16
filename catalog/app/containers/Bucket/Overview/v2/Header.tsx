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
import assertNever from 'utils/assertNever'
import { readableBytes, readableQuantity, formatQuantity } from 'utils/string'

import * as PD from '../../PackageDialog'
import * as requests from '../../requests'

import BUCKET_QUERY from '../gql/Bucket.generated'
import STAT_COUNTS_QUERY from '../gql/StatCounts.generated'

import Readme from './Readme'

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
  return { totalBytes, totalObjects, pkgCount }
}

const useStatsItemStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'baseline',
    display: 'flex',
  },
  label: {
    ...t.typography.body2,
    color: t.palette.grey[300],
    lineHeight: 1,
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
  label?: string
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
      <M.Link className={classes.root} color="inherit" component={RRLink} to={to}>
        {content}
      </M.Link>
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
  packages: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(2),
  },
}))

interface StatsProps {
  bucket: string
}

function Stats({ bucket }: StatsProps) {
  const classes = useStatsStyles()
  const { urls } = NamedRoutes.use()
  const { totalBytes, totalObjects, pkgCount } = useStats(bucket)
  return (
    <div className={classes.root}>
      {totalBytes ? <StatsItem value={totalBytes} /> : <StatsItemSkeleton />}
      {totalObjects ? (
        <StatsItem value={totalObjects} label="Objects" to={urls.bucketDir(bucket)} />
      ) : (
        <StatsItemSkeleton />
      )}
      <div className={classes.packages}>
        {pkgCount ? (
          <StatsItem
            value={pkgCount}
            label="Packages"
            to={urls.bucketPackageList(bucket)}
          />
        ) : (
          <StatsItemSkeleton />
        )}
        <CreatePackage bucket={bucket} />
      </div>
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
  root: {
    padding: t.spacing(3),
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
  },
  top: {
    display: 'flex',
    flexDirection: 'column',
    [t.breakpoints.up('sm')]: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  },
  identity: {
    flexShrink: 1,
    minWidth: 0,
  },
  settings: {
    marginLeft: t.spacing(1),
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
  return (
    <M.Paper className={classes.root}>
      <div className={classes.top}>
        <div className={classes.identity}>
          <M.Box display="flex" alignItems="center">
            <M.Typography variant="h5">{bucket}</M.Typography>
            {isAdmin && (
              <RRLink className={classes.settings} to={urls.adminBucketEdit(bucket)}>
                <M.IconButton size="small" color="inherit">
                  <M.Icon>settings</M.Icon>
                </M.IconButton>
              </RRLink>
            )}
          </M.Box>
          {!!description && (
            <M.Box mt={1}>
              <M.Typography variant="body1">{description}</M.Typography>
            </M.Box>
          )}
        </div>
        <Stats bucket={bucket} />
      </div>
      <Readme bucket={bucket} />
    </M.Paper>
  )
}
