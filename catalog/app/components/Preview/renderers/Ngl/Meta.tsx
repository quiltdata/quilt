import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonRecord } from 'utils/types'

const useStyles = M.makeStyles(() => ({
  root: {
    tableLayout: 'fixed',
    width: 'auto',
  },
}))

interface MetaProps {
  meta: JsonRecord
}

export default function Meta({ meta }: MetaProps) {
  const classes = useStyles()
  const entries = React.useMemo(
    () => Object.entries(meta).filter(([key, value]) => !!value),
    [meta],
  )
  return (
    <M.Table className={classes.root} size="small">
      <M.TableBody>
        {entries.map(([key, value]) => (
          <M.TableRow key={key + value}>
            <M.TableCell>
              <strong>{key}:</strong>
            </M.TableCell>
            <M.TableCell>{value}</M.TableCell>
          </M.TableRow>
        ))}
      </M.TableBody>
    </M.Table>
  )
}
