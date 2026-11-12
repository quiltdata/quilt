// Tables rail for the Athena console (table-support v1, plan section 4):
// Glue tables grouped by database, click-to-scope. Clicking a table selects
// its catalog + database in the console model and drafts a SELECT. Also
// consumes the `?catalog=&db=&table=` deep link from "Query this table".

import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as requests from 'containers/Bucket/Tables/requests'
import * as Model from './model'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(3, 0, 0),
  },
  label: {
    marginBottom: t.spacing(1),
  },
  group: {
    marginBottom: t.spacing(1),
  },
  groupLabel: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    marginTop: t.spacing(0.5),
  },
}))

// Athena/Presto identifier quoting: double any embedded double quote.
const quoteIdent = (s: string) => s.replace(/"/g, '""')

export default function GlueTables() {
  const classes = useStyles()
  const { queryBody, catalogName, database } = Model.use()
  const groups = requests.useTables()

  const handleSelect = React.useCallback(
    (catalog: string, db: string, table: string) => {
      const sql = `SELECT * FROM "${quoteIdent(catalog)}"."${quoteIdent(
        db,
      )}"."${quoteIdent(table)}" LIMIT 10`
      queryBody.setValue(sql)
      catalogName.setValue(catalog)
      database.setValue(db)
    },
    [queryBody, catalogName, database],
  )

  // Deep link: `?catalog=&db=&table=` scopes the console once on load, then
  // the params are consumed so edits and reloads are not re-seeded (same
  // pattern as TabulatorTables' `?table=`).
  const location = RRDom.useLocation()
  const history = RRDom.useHistory()
  const appliedRef = React.useRef(false)
  React.useEffect(() => {
    if (appliedRef.current) return
    const params = new URLSearchParams(location.search)
    const catalog = params.get('catalog')
    const db = params.get('db')
    if (!catalog || !db) return
    appliedRef.current = true
    const table = params.get('table')
    if (table) {
      handleSelect(catalog, db, table)
    } else {
      catalogName.setValue(catalog)
      database.setValue(db)
    }
    params.delete('catalog')
    params.delete('db')
    params.delete('table')
    history.replace({ ...location, search: params.toString() })
  }, [location, history, handleSelect, catalogName, database])

  if (!Model.hasData(groups.data) || !groups.data.length) return null

  return (
    <div className={classes.root}>
      <M.Typography className={classes.label} variant="body2" color="textSecondary">
        Scope the query to a table:
      </M.Typography>
      {groups.data.map((g) => (
        <div className={classes.group} key={`${g.catalog}.${g.database}`}>
          <div className={classes.groupLabel}>
            {g.database} <span>in {g.catalog}</span>
          </div>
          <div className={classes.chips}>
            {g.tables.map((t) => (
              <M.Tooltip
                key={t.name}
                title={`${t.catalog}.${t.database}.${t.name} (${t.columnCount} columns)`}
              >
                <M.Chip
                  clickable
                  label={t.name}
                  onClick={() => handleSelect(t.catalog, t.database, t.name)}
                  size="small"
                />
              </M.Tooltip>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
