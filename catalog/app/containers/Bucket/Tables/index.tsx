// The Tables layer of a volume (table-support v1 prototype): a peer of
// Packages and Files per quilt-specs table-support §5. List view groups
// Glue/Athena tables by database; the detail route renders schema, editable
// Quilt context, and an Athena preview.

import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import { useBucketStrict } from 'containers/Bucket/Routes'

import Detail from './Detail'
import List from './List'
import TablesAssistantContext from './AssistantContext'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(2),
  },
  title: {
    ...t.typography.h5,
    flexGrow: 1,
  },
  filter: {
    width: 320,
  },
}))

function TableListPage({ bucket }: { bucket: string }) {
  const classes = useStyles()
  const [filter, setFilter] = React.useState('')
  const groups = requests.useTables()
  return (
    <>
      <MetaTitle>{['Tables', bucket]}</MetaTitle>
      <TablesAssistantContext groups={groups.data} />
      <div className={classes.header}>
        <div className={classes.title}>Tables</div>
        <M.TextField
          className={classes.filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tables"
          size="small"
          value={filter}
          variant="outlined"
        />
      </div>
      <List bucket={bucket} filter={filter} groups={groups.data} />
    </>
  )
}

function TableDetailPage({ bucket, table }: { bucket: string; table: string }) {
  const location = RR.useLocation()
  const params = new URLSearchParams(location.search)
  // Coordinates arrive as search params from the list; a bare URL (shared
  // link without params) cannot resolve the table, so say so honestly.
  const catalog = params.get('catalog')
  const database = params.get('database')
  if (!catalog || !database) {
    return (
      <M.Typography color="textSecondary">
        This table link is missing its catalog/database coordinates. Open the table from
        the Tables list.
      </M.Typography>
    )
  }
  return (
    <>
      <MetaTitle>{[table, 'Tables', bucket]}</MetaTitle>
      <Detail bucket={bucket} catalog={catalog} database={database} table={table} />
    </>
  )
}

export default function Tables() {
  const bucket = useBucketStrict()
  const { table } = RR.useParams<{ table?: string }>()
  return table ? (
    <TableDetailPage bucket={bucket} table={decodeURIComponent(table)} />
  ) : (
    <TableListPage bucket={bucket} />
  )
}
