import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useFilterSectionStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
    paddingBottom: t.spacing(1),
    position: 'relative',
    '&:after': {
      background: t.palette.divider,
      border: `1px solid ${t.palette.background.paper}`,
      borderWidth: '1px 0',
      content: '""',
      height: '3px',
      left: '25%',
      position: 'absolute',
      right: '25%',
      bottom: 0,
    },
  },
}))

type FilterSectionProps = React.PropsWithChildren<{ className?: string }>

export default function FilterSection({ children, className }: FilterSectionProps) {
  const classes = useFilterSectionStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}
