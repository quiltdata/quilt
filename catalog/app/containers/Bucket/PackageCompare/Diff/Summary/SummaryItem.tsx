import * as React from 'react'
import * as M from '@material-ui/core'

import useColors from '../useColors'

const useSummaryItemStyles = M.makeStyles((t) => ({
  section: {
    margin: 0,
    padding: t.spacing(0.5, 0),
  },
  title: {
    ...t.typography.body2,
  },
  description: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    margin: 0,
  },
}))

interface SummaryItemProps {
  color?: keyof ReturnType<typeof useColors>
  title: string
  children: React.ReactNode | React.ReactNode[]
}

export default function SummaryItem({ children, color, title }: SummaryItemProps) {
  const classes = useSummaryItemStyles()
  const colors = useColors()
  return (
    <dl className={classes.section}>
      <dt className={classes.title}>
        <span className={color && colors[color]}>{title}</span>
      </dt>
      {Array.isArray(children) ? (
        children.map((child, index) => (
          <dd key={index} className={classes.description}>
            {child}
          </dd>
        ))
      ) : (
        <dd className={classes.description}>{children}</dd>
      )}
    </dl>
  )
}
