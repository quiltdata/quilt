import cx from 'classnames'
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
  className?: string
  items: Item[]
}

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
  },
  chip: {
    margin: t.spacing(0, 1, 1, 0),
    maxWidth: `calc(100% - ${t.spacing(1)}px)`,
    overflow: 'hidden',
  },
}))

interface ChipsSkeletonProps {
  className?: string
}

export function ChipsSkeleton({ className }: ChipsSkeletonProps) {
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
    <div className={cx(className, classes.root)}>
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
      <Skeleton {...props} width={genWidth()} />
    </div>
  )
}

export default function AvailableFacetsLists({
  className,
  items,
}: AvailableFacetsListsProps) {
  const classes = useStyles()
  return (
    <div className={cx(className, classes.root)}>
      {items.map((item, index) => (
        <M.Chip
          key={`${item.type}_${index}`}
          className={classes.chip}
          label={item.label}
          onClick={item.onClick}
          onDelete={item.onDelete}
        />
      ))}
    </div>
  )
}
