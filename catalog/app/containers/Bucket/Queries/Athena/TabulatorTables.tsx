import * as React from 'react'
import * as M from '@material-ui/core'

import type { ParsedTabulatorTable } from '../../Tabulator/requests'
import { useTabulatorTables, resolveTabulatorCatalog } from '../../Tabulator/requests'
import * as Model from './model'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0, 0),
  },
  label: {
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
}))

export default function TabulatorTables() {
  const classes = useStyles()
  const { bucket, queryBody, catalogName, catalogNames, database } = Model.use()
  const tables = useTabulatorTables(bucket)

  const handleSelect = React.useCallback(
    (table: ParsedTabulatorTable) => {
      const catalog = Model.hasData(catalogNames.data)
        ? resolveTabulatorCatalog(catalogNames.data.list)
        : undefined
      // Three-part, fully-qualified name runs regardless of the selected context;
      // fall back to two parts when the tabulator catalog can't be resolved yet.
      const sql = catalog
        ? `SELECT * FROM "${catalog}"."${bucket}"."${table.name}" LIMIT 100`
        : `SELECT * FROM "${bucket}"."${table.name}" LIMIT 100`
      queryBody.setValue(sql)
      if (catalog) {
        catalogName.setValue(catalog)
        database.setValue(bucket)
      }
    },
    [bucket, catalogNames.data, queryBody, catalogName, database],
  )

  // Render nothing on loading / error / empty — never break the Queries page.
  if (!Model.hasData(tables) || tables.length === 0) return null

  return (
    <div className={classes.root}>
      <M.Typography className={classes.label} variant="body2">
        Tabulator tables in {bucket}
      </M.Typography>
      <div className={classes.chips}>
        {tables.map((table) => (
          <M.Tooltip
            key={table.name}
            title={`${table.columns.length} columns${
              table.source ? ` · ${table.source.packageName.pretty}` : ''
            }`}
          >
            <M.Chip label={table.name} clickable onClick={() => handleSelect(table)} />
          </M.Tooltip>
        ))}
      </div>
    </div>
  )
}
