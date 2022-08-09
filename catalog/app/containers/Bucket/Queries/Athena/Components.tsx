import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Sentry from 'utils/Sentry'

const useSectionStyles = M.makeStyles((t) => ({
  header: {
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
  if (!children && empty)
    return <M.Typography className={cx(classes.header, className)}>{empty}</M.Typography>
  return (
    <div className={className}>
      <M.Typography className={classes.header}>{title}</M.Typography>
      {children}
    </div>
  )
}

interface AlertProps {
  error: Error
  title: string
}

export function Alert({ error, title }: AlertProps) {
  const sentry = Sentry.use()

  React.useEffect(() => {
    sentry('captureException', error)
  }, [error, sentry])

  return (
    <Lab.Alert severity="error">
      <Lab.AlertTitle>{title}</Lab.AlertTitle>
      {error.message}
    </Lab.Alert>
  )
}

export function makeAsyncDataErrorHandler(title: string) {
  return (error: Error) => <Alert error={error} title={title} />
}
