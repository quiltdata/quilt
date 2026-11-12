import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Empty from 'components/Empty'
import Skeleton from 'components/Skeleton'
import * as Format from 'utils/format'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as Model from 'containers/Queries/Athena/model/utils'

import FormatBadge from './FormatBadge'
import type { DatabaseGroup, TableSummary } from './requests'

const useRowStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    padding: t.spacing(1.5, 2),
    position: 'relative',
  },
  main: {
    flexGrow: 1,
    minWidth: 0,
  },
  name: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
  },
  coordinates: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    flexShrink: 0,
    marginLeft: t.spacing(2),
    textAlign: 'right',
  },
  badge: {
    flexShrink: 0,
    marginLeft: t.spacing(2),
  },
  actions: {
    flexShrink: 0,
    marginLeft: t.spacing(2),
  },
  clickArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hover: {
    '&:hover': {
      background: t.palette.action.hover,
    },
  },
}))

interface TableRowProps {
  bucket: string
  table: TableSummary
}

function TableRow({ bucket, table }: TableRowProps) {
  const classes = useRowStyles()
  const { urls } = NamedRoutes.use()
  const detailUrl = urls.bucketTableDetail(bucket, table.name, {
    catalog: table.catalog,
    database: table.database,
  })
  const queryUrl = urls.queriesAthena({
    catalog: table.catalog,
    db: table.database,
    table: table.name,
  })
  return (
    <div className={`${classes.root} ${classes.hover}`}>
      <div className={classes.main}>
        <RR.Link className={classes.name} to={detailUrl}>
          {table.name}
          <span className={classes.clickArea} />
        </RR.Link>
        <div className={classes.coordinates}>
          {table.catalog}.{table.database}.{table.name}
        </div>
      </div>
      <div className={classes.meta}>
        <div>
          <Format.Plural
            value={table.columnCount}
            one="1 column"
            other={(n) => `${n} columns`}
          />
        </div>
        {!!table.updatedAt && (
          <div>
            updated <Format.Relative value={table.updatedAt} />
          </div>
        )}
      </div>
      <FormatBadge className={classes.badge} format={table.format} />
      <div className={classes.actions}>
        <M.Button
          color="primary"
          component={RR.Link}
          size="small"
          to={queryUrl}
          variant="outlined"
        >
          Query
        </M.Button>
      </div>
    </div>
  )
}

const useGroupStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(3),
  },
  header: {
    alignItems: 'baseline',
    display: 'flex',
    marginBottom: t.spacing(1),
  },
  database: {
    ...t.typography.subtitle1,
    fontWeight: t.typography.fontWeightMedium,
  },
  catalog: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    marginLeft: t.spacing(1),
  },
  paper: {
    // Rows divide with hairlines inside one Paper, same rhythm as PackageList.
    '& > *:not(:last-child)': {
      borderBottom: `1px solid ${t.palette.divider}`,
    },
  },
}))

interface GroupProps {
  bucket: string
  group: DatabaseGroup
}

function Group({ bucket, group }: GroupProps) {
  const classes = useGroupStyles()
  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <div className={classes.database}>{group.database}</div>
        <div className={classes.catalog}>in {group.catalog}</div>
      </div>
      <M.Paper className={classes.paper}>
        {group.tables.map((table) => (
          <TableRow
            key={`${table.catalog}.${table.database}.${table.name}`}
            bucket={bucket}
            table={table}
          />
        ))}
      </M.Paper>
    </div>
  )
}

function ListSkeleton() {
  return (
    <>
      <Skeleton height={32} width={240} animate />
      <Skeleton height={64} mt={1} animate />
      <Skeleton height={64} mt={1} animate />
      <Skeleton height={64} mt={1} animate />
    </>
  )
}

interface ListProps {
  bucket: string
  groups: Model.Data<DatabaseGroup[]>
  filter: string
}

function filterGroups(groups: DatabaseGroup[], filter: string): DatabaseGroup[] {
  if (!filter) return groups
  const f = filter.toLowerCase()
  return groups
    .map((g) => ({
      ...g,
      tables: g.tables.filter(
        (t) => t.name.toLowerCase().includes(f) || g.database.toLowerCase().includes(f),
      ),
    }))
    .filter((g) => g.tables.length)
}

export default function List({ bucket, groups, filter }: ListProps) {
  if (Model.isError(groups)) {
    return (
      <Lab.Alert severity="error">
        <Lab.AlertTitle>Could not list tables</Lab.AlertTitle>
        {groups.message}
      </Lab.Alert>
    )
  }
  if (!Model.hasData(groups)) return <ListSkeleton />
  const filtered = filterGroups(groups, filter)
  if (!filtered.length) {
    return (
      <Empty title={filter ? 'No matching tables' : 'No tables registered yet'}>
        {filter
          ? 'Try a different filter'
          : 'Tables appear here when a Glue table is visible to this stack'}
      </Empty>
    )
  }
  return (
    <>
      {filtered.map((group) => (
        <Group key={`${group.catalog}.${group.database}`} bucket={bucket} group={group} />
      ))}
    </>
  )
}
