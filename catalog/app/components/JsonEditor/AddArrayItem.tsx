import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  buttonCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: `1px 0 0`,
    padding: t.spacing(1, 0),
    width: t.spacing(20),
  },
  emptyCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: `1px 0 0`,
  },
}))

interface AddArrayItemProps {
  className?: string
  columnPath: string[]
  index: number
  onAdd: (path: string[], index: number, value: string) => void
}

export default function AddArrayItem({
  className,
  columnPath,
  index,
  onAdd,
}: AddArrayItemProps) {
  const classes = useStyles()

  const onClick = React.useCallback(() => {
    onAdd(columnPath, index, '')
  }, [columnPath, index, onAdd])

  return (
    <M.TableRow>
      <M.TableCell className={cx(classes.buttonCell, className)}>
        <M.Button variant="outlined" size="small" onClick={onClick}>
          Add array item
        </M.Button>
      </M.TableCell>
      <M.TableCell className={classes.emptyCell} />
    </M.TableRow>
  )
}
