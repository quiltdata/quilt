import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
  },
  // Default inner padding; omitted for `flush` cards that own their own layout
  // edge-to-edge (e.g. the Qurator chat).
  padded: {
    padding: t.spacing(3),
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(2),
    },
  },
  // Subtle accent for the Qurator section; keeps its identity while sharing the
  // same radius / elevation as every other section card.
  tint: {
    background: M.colors.indigo[50],
  },
}))

interface SectionCardProps {
  className?: string
  tint?: boolean
  flush?: boolean
}

export default function SectionCard({
  className,
  tint,
  flush,
  children,
}: React.PropsWithChildren<SectionCardProps>) {
  const classes = useStyles()
  return (
    <M.Paper
      className={cx(
        classes.root,
        !flush && classes.padded,
        tint && classes.tint,
        className,
      )}
    >
      {children}
    </M.Paper>
  )
}
