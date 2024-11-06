import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useSectionStyles = M.makeStyles((t) => ({
  header: {
    ...t.typography.body2,
    margin: t.spacing(0, 0, 1),
  },
}))

interface SectionProps {
  children: React.ReactNode
  className?: string
  empty?: React.ReactNode
  title: string
}

export function Section({ className, empty, title, children }: SectionProps) {
  const classes = useSectionStyles()
  if (!children && empty) {
    return <div className={cx(classes.header, className)}>{empty}</div>
  }
  return (
    <div className={className}>
      <div className={classes.header}>{title}</div>
      {children}
    </div>
  )
}

interface AlertProps {
  className?: string
  error: Error
  title: string
}

export function Alert({ className, error, title }: AlertProps) {
  return (
    <Lab.Alert severity="error" className={className}>
      <Lab.AlertTitle>{title}</Lab.AlertTitle>
      {error.message}
    </Lab.Alert>
  )
}
