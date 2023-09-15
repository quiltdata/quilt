import * as React from 'react'
import * as M from '@material-ui/core'

export function AvailableFacet(props: M.ChipProps) {
  return <M.Chip {...props} />
}

interface Item {
  label: string
  type: string
}

interface AvailableFacetsListsProps {
  items: Item[]
  onClick: (item: Item) => void
}

const useStyles = M.makeStyles((t) => ({
  chip: {
    margin: t.spacing(0, 1, 1, 0),
  },
}))

export default function AvailableFacetsLists({
  items,
  onClick,
}: AvailableFacetsListsProps) {
  const classes = useStyles()
  return (
    <>
      {items.map((item) => (
        <M.Chip
          key={item.type}
          className={classes.chip}
          label={item.label}
          onClick={() => onClick(item)}
        />
      ))}
    </>
  )
}
