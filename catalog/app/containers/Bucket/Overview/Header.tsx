import type AWSSDK from 'aws-sdk'
import cx from 'classnames'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import useConst from 'utils/useConstant'

import * as requests from '../requests'

import { makeColorPool } from './ColorPool'
import Downloads from './Downloads'
import ObjectsByExt, { COLOR_MAP, MAX_EXTS } from './ObjectsByExt'

import bg from './Overview-bg.jpg'

import { useStats } from './useStats'

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
  value: React.ReactNode
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
}

function Stats({ className, bucket }: StatsProps) {
  const classes = useStatsStyles()
  const { totalBytes, totalObjects, pkgCount } = useStats(bucket)
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
  description: string | null | undefined
}

export default function Header({ s3, bucket, description }: HeaderProps) {
  const classes = useStyles()
  const req = APIConnector.use()
  const colorPool = useConst(() => makeColorPool(COLOR_MAP))
  const statsData = useData(requests.bucketStats, { req, s3, bucket })
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
        <Stats className={classes.stats} bucket={bucket} />
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
