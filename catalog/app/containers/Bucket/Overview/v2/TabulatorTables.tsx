import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'

// Schema-free generic async-state helpers; they merely live under the Athena
// folder. Candidate for relocation to a neutral `utils/` location.
import * as Model from '../../Queries/Athena/model/utils'
import { useTabulatorTables } from '../../Tabulator/requests'

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
  },
  footer: {
    padding: t.spacing(1, 2),
  },
}))

interface TabulatorTablesProps {
  bucket: string
}

export default function TabulatorTables({ bucket }: TabulatorTablesProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const tables = useTabulatorTables(bucket)

  if (Model.isLoading(tables)) return <M.LinearProgress />

  if (Model.isError(tables)) {
    return (
      <M.Typography color="textSecondary" variant="body2">
        Could not load Tabulator tables
      </M.Typography>
    )
  }

  if (!Model.hasData(tables) || tables.length === 0) return null

  return (
    <M.Paper className={classes.root}>
      <M.List
        subheader={<M.ListSubheader disableSticky>Tabulator tables</M.ListSubheader>}
      >
        {tables.map((table) => (
          <M.ListItem key={table.name}>
            <M.ListItemText primary={table.name} />
          </M.ListItem>
        ))}
      </M.List>
      <M.Divider />
      <div className={classes.footer}>
        <M.Link component={RRLink} to={urls.bucketQueries(bucket)}>
          More queries &rarr;
        </M.Link>
      </div>
    </M.Paper>
  )
}
