import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  inputCell: {
    border: `1px solid ${t.palette.grey[300]}`,
    padding: 0,
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(27),
    },
  },
  emptyCell: {
    border: `1px solid ${t.palette.grey[300]}`,
    padding: 0,
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(40),
    },
  },
  cellContent: {
    height: t.spacing(4),
  },
}))

export default function EmptyRow() {
  const classes = useStyles()
  return (
    <M.TableRow>
      <M.TableCell className={classes.inputCell}>
        <div className={classes.cellContent} />
      </M.TableCell>
      <M.TableCell className={classes.emptyCell}>
        <div className={classes.cellContent} />
      </M.TableCell>
    </M.TableRow>
  )
}
