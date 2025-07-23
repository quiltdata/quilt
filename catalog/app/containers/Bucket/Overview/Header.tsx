import type AWSSDK from 'aws-sdk'
import cx from 'classnames'
import * as Eff from 'effect'
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
import useConst from 'utils/useConstant'

import * as requests from '../requests'

import { ColorPool, makeColorPool } from './ColorPool'
import Downloads from './Downloads'

import bg from './Overview-bg.jpg'

import STAT_COUNTS_QUERY from './gql/StatCounts.generated'

// interface StatsData {
//   exts: ExtData[]
//   totalObjects: number
//   totalBytes: number
// }

interface ExtData {
  ext: string
  bytes: number
  objects: number
}

const RODA_LINK = 'https://registry.opendata.aws'
const RODA_BUCKET = 'quilt-open-data-bucket'
const MAX_EXTS = 7
// must have length >= MAX_EXTS
const COLOR_MAP = [
  '#8ad3cb',
  '#d7ce69',
  '#bfbadb',
  '#f4806c',
  '#83b0d1',
  '#b2de67',
  '#bc81be',
  '#f0b5d3',
  '#7ba39f',
  '#9894ad',
  '#be7265',
  '#94ad6b',
]

const useObjectsByExtStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridAutoRows: 20,
    gridColumnGap: t.spacing(1),
    gridRowGap: t.spacing(0.25),
    gridTemplateAreas: `
      ". heading heading"
    `,
    gridTemplateColumns: 'minmax(30px, max-content) 1fr minmax(30px, max-content)',
    gridTemplateRows: 'auto',
    [t.breakpoints.down('sm')]: {
      gridTemplateAreas: `
        "heading heading heading"
      `,
    },
  },
  heading: {
    ...t.typography.h6,
    gridArea: 'heading',
    marginBottom: t.spacing(1),
    [t.breakpoints.down('sm')]: {
      textAlign: 'center',
    },
  },
  ext: {
    color: t.palette.text.secondary,
    gridColumn: 1,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    textAlign: 'right',
  },
  count: {
    color: t.palette.text.secondary,
    gridColumn: 3,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
  },
  bar: {
    background: t.palette.action.hover,
    gridColumn: 2,
  },
  gauge: {
    height: '100%',
    position: 'relative',
  },
  flip: {},
  size: {
    color: t.palette.common.white,
    fontSize: t.typography.overline.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: t.typography.subtitle2.letterSpacing,
    lineHeight: t.typography.pxToRem(20),
    position: 'absolute',
    right: t.spacing(1),
    '&$flip': {
      color: t.palette.text.hint,
      left: `calc(100% + ${t.spacing(1)}px)`,
      right: 'auto',
    },
  },
  skeleton: {
    gridColumn: '1 / span 3',
  },
  unavail: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    gridColumn: '1 / span 3',
    gridRow: `2 / span ${MAX_EXTS}`,
    justifyContent: 'center',
  },
}))

interface ObjectsByExtProps extends M.BoxProps {
  data: $TSFixMe // AsyncResult<ExtData[]>
  colorPool: ColorPool
}

function ObjectsByExt({ data, colorPool, ...props }: ObjectsByExtProps) {
  const classes = useObjectsByExtStyles()
  return (
    <M.Box className={classes.root} {...props}>
      <div className={classes.heading}>Objects by File Extension</div>
      {AsyncResult.case(
        {
          Ok: (exts: ExtData[]) => {
            const capped = exts.slice(0, MAX_EXTS)
            const maxBytes = capped.reduce((max, e) => Math.max(max, e.bytes), 0)
            const max = Math.log(maxBytes + 1)
            const scale = (x: number) => Math.log(x + 1) / max
            return capped.map(({ ext, bytes, objects }, i) => {
              const color = colorPool.get(ext)
              return (
                <React.Fragment key={`ext:${ext}`}>
                  <div className={classes.ext} style={{ gridRow: i + 2 }}>
                    {ext || 'other'}
                  </div>
                  <div className={classes.bar} style={{ gridRow: i + 2 }}>
                    <div
                      className={classes.gauge}
                      style={{
                        background: color,
                        width: `${scale(bytes) * 100}%`,
                      }}
                    >
                      <div
                        className={cx(classes.size, {
                          [classes.flip]: scale(bytes) < 0.3,
                        })}
                      >
                        {readableBytes(bytes)}
                      </div>
                    </div>
                  </div>
                  <div className={classes.count} style={{ gridRow: i + 2 }}>
                    {readableQuantity(objects)}
                  </div>
                </React.Fragment>
              )
            })
          },
          _: (r: $TSFixMe) => (
            <>
              {Eff.Array.makeBy(MAX_EXTS, (i) => (
                <Skeleton
                  key={`skeleton:${i}`}
                  className={classes.skeleton}
                  style={{ gridRow: i + 2 }}
                  animate={!AsyncResult.Err.is(r)}
                />
              ))}
              {AsyncResult.Err.is(r) && (
                <div className={classes.unavail}>Data unavailable</div>
              )}
            </>
          ),
        },
        data,
      )}
    </M.Box>
  )
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
    marginLeft: t.spacing(0.5),
    [t.breakpoints.up('sm')]: {
      marginLeft: t.spacing(1),
    },
  },
  value: {
    fontSize: t.typography.h6.fontSize,
    fontWeight: t.typography.fontWeightBold,
    letterSpacing: 0,
    lineHeight: '20px',
    [t.breakpoints.up('sm')]: {
      fontSize: t.typography.h4.fontSize,
      lineHeight: '32px',
    },
  },
}))

interface StatsItemProps {
  label?: string
  value: string
}

function StatsItem({ label, value }: StatsItemProps) {
  const classes = useStatsItemStyles()
  return (
    <span className={classes.root}>
      <span className={classes.value}>{value}</span>
      {!!label && <span className={classes.label}>{label}</span>}
    </span>
  )
}

const useStatsItemSkeletonStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    height: 20,
    [t.breakpoints.up('sm')]: {
      height: 32,
    },
  },
  skeleton: {
    borderRadius: t.shape.borderRadius,
    height: t.typography.h6.fontSize,
    width: 96,
    [t.breakpoints.up('sm')]: {
      height: t.typography.h4.fontSize,
      width: 120,
    },
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

function useStats(bucket: string, overviewUrl?: string | null) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const statsData = useData(requests.bucketStats, { req, s3, bucket, overviewUrl })
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
            case 'InvalidInput':
              return '?'
            case 'PackagesSearchResultSet':
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

const useStatsStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    alignItems: 'baseline',
    gridTemplateColumns: 'auto auto auto',
    gridColumnGap: t.spacing(1.5),
    justifyContent: 'flex-start',
    [t.breakpoints.up('sm')]: {
      gridColumnGap: t.spacing(4),
    },
    [t.breakpoints.up('md')]: {
      gridColumnGap: t.spacing(6),
    },
  },
}))

interface StatsProps {
  className: string
  bucket: string
  overviewUrl?: string | null
}

function Stats({ className, bucket, overviewUrl }: StatsProps) {
  const classes = useStatsStyles()
  const { totalBytes, totalObjects, pkgCount } = useStats(bucket, overviewUrl)
  return (
    <div className={cx(classes.root, className)}>
      {totalBytes ? <StatsItem value={totalBytes} /> : <StatsItemSkeleton />}
      {totalObjects ? (
        <StatsItem value={totalObjects} label="Objects" />
      ) : (
        <StatsItemSkeleton />
      )}
      {pkgCount ? <StatsItem value={pkgCount} label="Packages" /> : <StatsItemSkeleton />}
    </div>
  )
}

// use the same height as the bar chart: 20px per bar with 2px margin
const DOWNLOADS_CHART_H = 22 * MAX_EXTS - 2

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
    },
  },
  top: {
    background: `center / cover url(${bg}) ${t.palette.grey[700]}`,
    borderTopLeftRadius: t.shape.borderRadius,
    borderTopRightRadius: t.shape.borderRadius,
    color: t.palette.common.white,
    overflow: 'hidden',
    paddingBottom: t.spacing(3),
    paddingLeft: t.spacing(2),
    paddingRight: t.spacing(2),
    paddingTop: t.spacing(4),
    position: 'relative',
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(4),
    },
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
  },
  settings: {
    color: t.palette.common.white,
    position: 'absolute',
    right: t.spacing(2),
    top: t.spacing(2),
  },
  stats: {
    [t.breakpoints.down('xs')]: {
      marginTop: t.spacing(2),
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(3),
    },
  },
}))

interface HeaderProps {
  s3: AWSSDK.S3
  bucket: string
  overviewUrl: string | null | undefined
  description: string | null | undefined
}

export default function Header({ s3, overviewUrl, bucket, description }: HeaderProps) {
  const classes = useStyles()
  const req = APIConnector.use()
  const isRODA = !!overviewUrl && overviewUrl.includes(`/${RODA_BUCKET}/`)
  const colorPool = useConst(() => makeColorPool(COLOR_MAP))
  const statsData = useData(requests.bucketStats, { req, s3, bucket, overviewUrl })
  const { urls } = NamedRoutes.use()
  const isAdmin = redux.useSelector(authSelectors.isAdmin)
  return (
    <M.Paper className={classes.root}>
      <M.Box className={classes.top}>
        <M.Typography variant="h5">{bucket}</M.Typography>
        {!!description && (
          <M.Box mt={1}>
            <M.Typography variant="body1">{description}</M.Typography>
          </M.Box>
        )}
        {isRODA && (
          <M.Box
            mt={1}
            position={{ md: 'absolute' }}
            right={{ md: 32 }}
            bottom={{ md: 31 }}
            color="grey.300"
            textAlign={{ md: 'right' }}
          >
            <M.Typography variant="body2">
              From the{' '}
              <M.Link href={RODA_LINK} color="inherit" underline="always">
                Registry of Open Data on AWS
              </M.Link>
            </M.Typography>
          </M.Box>
        )}
        <Stats className={classes.stats} bucket={bucket} overviewUrl={overviewUrl} />
        {isAdmin && (
          <RRLink className={classes.settings} to={urls.adminBucketEdit(bucket)}>
            <M.IconButton color="inherit">
              <M.Icon>settings</M.Icon>
            </M.IconButton>
          </RRLink>
        )}
      </M.Box>
      <M.Box
        p={{ xs: 2, sm: 4 }}
        display="flex"
        flexDirection={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'flex-start' }}
        position="relative"
      >
        <ObjectsByExt
          data={AsyncResult.prop('exts', statsData.result)}
          width="100%"
          flexShrink={1}
          colorPool={colorPool}
        />
        <M.Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          flexShrink={0}
          height={{ xs: 32, md: '100%' }}
          width={{ xs: '100%', md: 32 }}
        >
          <M.Hidden mdUp>
            <M.Divider />
          </M.Hidden>
        </M.Box>
        <Downloads
          bucket={bucket}
          colorPool={colorPool}
          width="100%"
          flexShrink={1}
          chartHeight={DOWNLOADS_CHART_H}
        />
      </M.Box>
    </M.Paper>
  )
}
