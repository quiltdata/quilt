import * as React from 'react'
import * as M from '@material-ui/core'

export function Message({ children }: React.PropsWithChildren<{}>) {
  return <M.Typography variant="body1">{children}</M.Typography>
}

const useContainerStyles = M.makeStyles((t) => ({
  container: {
    marginBottom: t.spacing(4),
    marginTop: t.spacing(3),
  },
}))

export function Container({ children }: React.PropsWithChildren<{}>) {
  const classes = useContainerStyles()
  return <section className={classes.container}>{children}</section>
}

const useHeadingStyles = M.makeStyles((t) => ({
  heading: {
    ...t.typography.h5,
    marginBottom: t.spacing(3),
  },
}))

export function Heading({ children }: React.PropsWithChildren<{}>) {
  const classes = useHeadingStyles()
  return <h1 className={classes.heading}>{children}</h1>
}
