import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { bucketAthena } from 'constants/routes'
import { useRelevantBuckets } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import mkSearch from 'utils/mkSearch'

import BUCKET_TABLES_QUERY from '../gql/BucketTables.generated'
import TileCard from './TileCard'

// Tabulator tables are bucket-scoped. To avoid an N+1 fan-out across every
// bucket, we probe only the top relevant buckets and render a bounded row list.
const BUCKET_PROBE_LIMIT = 6
const ROW_LIMIT = 6

const useStyles = M.makeStyles((t) => ({
  item: {
    alignItems: 'baseline',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: 13,
    gap: t.spacing(1),
    padding: t.spacing(0.5, 0),
    textDecoration: 'none',
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  icon: {
    fontSize: 15,
    opacity: 0.6,
    position: 'relative',
    top: 2,
  },
  body: {
    minWidth: 0,
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: 11,
    opacity: 0.7,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

export interface TableRow {
  bucket: string
  table: string
}

// Deep-links a Tabulator table to its bucket-scoped Athena editor, matching the
// `?table=<name>` affordance from the Overview v2 Tabulator chips.
export function tableHref(bucket: string, table: string): string {
  return `${bucketAthena.url(bucket)}${mkSearch({ table })}`
}

interface BucketTablesProbeProps {
  bucket: string
  onResult: (bucket: string, tables: string[]) => void
}

// One stable query hook per probed bucket. Mounting a fixed-length list of these
// keeps the number of hooks constant across renders (no conditional hooks).
function BucketTablesProbe({ bucket, onResult }: BucketTablesProbeProps) {
  const result = GQL.useQuery(BUCKET_TABLES_QUERY, { bucket })

  React.useEffect(() => {
    if (result.fetching) return
    const cfg = result.data?.bucketConfig
    const tables = cfg?.tabulatorTables?.map((tt) => tt.name) ?? []
    onResult(bucket, tables)
  }, [bucket, onResult, result.data, result.fetching])

  return null
}

export default function TablesTile() {
  const classes = useStyles()
  const buckets = useRelevantBuckets()

  const probed = React.useMemo(
    () => buckets.slice(0, BUCKET_PROBE_LIMIT).map((b) => b.name),
    [buckets],
  )

  const [byBucket, setByBucket] = React.useState<Record<string, string[]>>({})

  const handleResult = React.useCallback((bucket: string, tables: string[]) => {
    setByBucket((prev) => {
      const existing = prev[bucket]
      if (
        existing &&
        existing.length === tables.length &&
        existing.every((t, i) => t === tables[i])
      ) {
        return prev
      }
      return { ...prev, [bucket]: tables }
    })
  }, [])

  const rows = React.useMemo(() => {
    const out: TableRow[] = []
    for (const bucket of probed) {
      for (const table of byBucket[bucket] || []) {
        out.push({ bucket, table })
        if (out.length >= ROW_LIMIT) return out
      }
    }
    return out
  }, [byBucket, probed])

  const done = probed.every((b) => b in byBucket)

  return (
    <TileCard icon="table_chart" title="Tables">
      {probed.map((bucket) => (
        <BucketTablesProbe key={bucket} bucket={bucket} onResult={handleResult} />
      ))}
      {!done && !rows.length && (
        <M.Typography color="textSecondary" variant="body2">
          Loading tables…
        </M.Typography>
      )}
      {done && !rows.length && (
        <M.Typography color="textSecondary" variant="body2">
          No tables in your top buckets
        </M.Typography>
      )}
      {rows.map((row) => (
        <Link
          key={`${row.bucket}/${row.table}`}
          to={tableHref(row.bucket, row.table)}
          className={classes.item}
        >
          <M.Icon className={classes.icon}>table_chart</M.Icon>
          <span className={classes.body}>
            <div className={classes.name}>{row.table}</div>
            <div className={classes.meta}>{row.bucket}</div>
          </span>
        </Link>
      ))}
    </TileCard>
  )
}
