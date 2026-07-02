import type AWSSDK from 'aws-sdk'
import cx from 'classnames'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

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

import { useStats } from './useStats'

const useStatsItemStyles = M.makeStyles((t) => ({
  // White stat card with a tinted icon tile, per the redesign mock.
  root: {
    alignItems: 'center',
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: 12,
    display: 'flex',
    gap: t.spacing(2),
    padding: t.spacing(2.5, 2.75),
  },
  iconTile: {
    alignItems: 'center',
    borderRadius: 10,
    display: 'flex',
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
    '& .material-icons': {
      fontSize: 22,
    },
  },
  text: {
    lineHeight: 1.1,
    minWidth: 0,
  },
  value: {
    color: t.palette.text.primary,
    display: 'block',
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 28,
    fontWeight: 300,
  },
  label: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    display: 'block',
    fontWeight: 500,
    marginTop: 4,
  },
}))

interface StatsItemProps {
  label?: string
  value: React.ReactNode
  icon: string
  color: string
}

function StatsItem({ label, value, icon, color }: StatsItemProps) {
  const classes = useStatsItemStyles()
  return (
    <div className={classes.root}>
      <span className={classes.iconTile} style={{ background: fade(color, 0.13), color }}>
        <M.Icon>{icon}</M.Icon>
      </span>
      <span className={classes.text}>
        {value ? <span className={classes.value}>{value}</span> : <StatsItemSkeleton />}
        {!!label && <span className={classes.label}>{label}</span>}
      </span>
    </div>
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
  // 3-across stat card grid from the redesign mock.
  root: {
    display: 'grid',
    gridGap: t.spacing(2),
    gridTemplateColumns: 'repeat(3, 1fr)',
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
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
      <StatsItem
        value={totalBytes}
        label="Total size"
        icon="cloud_done"
        color="#43a047"
      />
      <StatsItem
        value={totalObjects}
        label="Objects"
        icon="insert_drive_file"
        color="#5471f1"
      />
      <StatsItem value={pkgCount} label="Packages" icon="layers" color="#fb8c00" />
    </div>
  )
}

// use the same height as the bar chart: 20px per bar with 2px margin
const DOWNLOADS_CHART_H = 22 * MAX_EXTS - 2

const useStyles = M.makeStyles((t) => ({
  // Flat overview header per the redesign mock: title row, then a 3-card stat
  // grid, then the charts on a plain card. The legacy hero image is gone.
  root: {
    position: 'relative',
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
    },
  },
  top: {
    padding: t.spacing(2, 2, 3),
    position: 'relative',
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(0, 0, 3),
    },
  },
  settings: {
    position: 'absolute',
    right: 0,
    top: t.spacing(1),
  },
  stats: {
    marginTop: t.spacing(3),
  },
  charts: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: 12,
    boxShadow: 'none',
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
    <div className={classes.root}>
      <M.Box className={classes.top}>
        <M.Typography variant="h5">{bucket}</M.Typography>
        {!!description && (
          <M.Box mt={1}>
            <M.Typography variant="body1" color="textSecondary">
              {description}
            </M.Typography>
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
        component={M.Paper}
        className={classes.charts}
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
    </div>
  )
}
