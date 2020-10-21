import * as React from 'react'

import * as M from '@material-ui/core'

const i18nMsgs = {
  button: 'Add list item',
}

const useStyles = M.makeStyles((t) => ({
  buttonCell: {
    border: 0,
    width: t.spacing(20),
  },
  emptyCell: {
    border: 0,
  },
}))

export default function AddArrayItem({ columnPath, index, onAdd }) {
  const classes = useStyles()

  const onClick = React.useCallback(() => {
    onAdd(columnPath, index)
  }, [columnPath, index, onAdd])

  return (
    <M.TableRow>
      <M.TableCell className={classes.buttonCell}>
        <M.Button variant="outlined" size="small" onClick={onClick}>
          {i18nMsgs.button}
        </M.Button>
      </M.TableCell>
      <M.TableCell className={classes.emptyCell} />
    </M.TableRow>
  )
}
