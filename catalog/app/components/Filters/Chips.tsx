import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

export function AvailableFacet(props: M.ChipProps) {
  return <M.Chip {...props} />
}

interface Item {
  label: React.ReactNode
  type: string
  onClick?: () => void
  onDelete?: () => void
}

interface AvailableFacetsListsProps {
  items: Item[]
}

const useStyles = M.makeStyles((t) => ({
  chip: {
    margin: t.spacing(0, 1, 1, 0),
  },
}))

export function ChipsSkeleton() {
  const classes = useStyles()
  const maxWidth = 180
  const minWidth = 60
  const props = {
    height: 24,
    display: 'inline-block',
    className: classes.chip,
  }
  const genWidth = () => Math.max(Math.ceil(Math.random() * maxWidth), minWidth)
  return (
    <>
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
    </>
  )
}

export default function AvailableFacetsLists({ items }: AvailableFacetsListsProps) {
  const classes = useStyles()
  return (
    <>
      {items.map((item, index) => (
        <M.Chip
          key={`${item.type}_${index}`}
          className={classes.chip}
          label={item.label}
          onClick={item.onClick}
          onDelete={item.onDelete}
        />
      ))}
    </>
  )
}
