import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    justifyContent: 'center',
    margin: 'auto',
    marginTop: t.spacing(2),
    maxWidth: '30rem',
    paddingBottom: t.spacing(2),
    '& > :first-child': {
      flexShrink: 0,
      margin: t.spacing(0, 2),
    },
    '& > :nth-child(2)': {
      flexBasis: '40%',
    },
  },
  description: {
    ...t.typography.body1,
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    marginTop: t.spacing(3),
    maxWidth: '30rem',
  },
}))

interface EmptyProps {
  children?: React.ReactNode
  className?: string
  description?: React.ReactNode
  title?: string
}

export default function Empty({ className, children, description, title }: EmptyProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      {title && <M.Typography variant="h4">{title}</M.Typography>}

      {description && <div className={classes.main}>{description}</div>}

      {children && <div className={classes.description}>{children}</div>}
    </div>
  )
}
