import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Sentry from '@sentry/react'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    padding: t.spacing(1),
    backgroundColor: t.palette.error.light,
    color: t.palette.error.contrastText,
  },
  message: {
    marginLeft: t.spacing(1),
    flexGrow: 1,
  },
}))

function ToolbarErrorBoundaryPlaceholder({ resetErrorBoundary }: FallbackProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Icons.ErrorOutline fontSize="small" />
      <div className={classes.message}>
        <M.Typography variant="body2">Toolbar error occurred</M.Typography>
      </div>
      <M.IconButton size="small" onClick={resetErrorBoundary} color="inherit">
        <Icons.Refresh fontSize="small" />
      </M.IconButton>
    </div>
  )
}

const onError = (error: Error) => Sentry.captureException(error)

export default function ToolbarErrorBoundary({ children }: React.PropsWithChildren<{}>) {
  return (
    <ErrorBoundary
      {...{ FallbackComponent: ToolbarErrorBoundaryPlaceholder, onError, children }}
    />
  )
}
