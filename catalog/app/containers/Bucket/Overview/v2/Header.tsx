import * as React from 'react'
import * as M from '@material-ui/core'

import AsyncResult from 'utils/AsyncResult'
import * as GQL from 'utils/GraphQL'
import useConst from 'utils/useConstant'

import { makeColorPool } from '../ColorPool'
import ObjectsByExt, { COLOR_MAP } from '../ObjectsByExt'

import BUCKET_QUERY from '../gql/Bucket.generated'
import { useStats, type StatsData } from '../useStats'

import Readme from './Readme'
import RecentPackages from './RecentPackages'

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
    minHeight: t.spacing(4),
  },
  divider: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: t.spacing(4),
    justifyContent: 'center',
    width: '100%',
    [t.breakpoints.up('md')]: {
      height: '100%',
      width: t.spacing(4),
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
  description: {
    marginBottom: t.spacing(2),
  },
}))

interface HeaderProps {
  bucket: string
}

// The bucket name / stats / create-package now live above the tabs
// (containers/Bucket/Header); the Overview's first section is the description,
// README, and charts.
export default function Header({ bucket }: HeaderProps) {
  const classes = useStyles()
  const { bucket: bucketData } = GQL.useQueryS(BUCKET_QUERY, { bucket })
  const description = bucketData?.description
  const stats = useStats(bucket)
  return (
    <M.Paper className={classes.root}>
      {!!description && (
        <M.Typography className={classes.description} variant="body1">
          {description}
        </M.Typography>
      )}
      <Readme bucket={bucket} />
      <Charts bucket={bucket} statsResult={stats.statsResult} />
    </M.Paper>
  )
}
