import * as React from 'react'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'
import {
  ErrorOutline as IconErrorOutline,
  Refresh as IconRefresh,
} from '@material-ui/icons'

import { createBoundary } from 'utils/ErrorBoundary'

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

interface ToolbarErrorBoundaryPlaceholderProps {
  error: Error
  info: any
  reset: () => void
}

function ToolbarErrorBoundaryPlaceholder({
  error,
  info,
  reset,
}: ToolbarErrorBoundaryPlaceholderProps) {
  const classes = useStyles()

  React.useEffect(() => {
    Sentry.captureException(error, info)
  }, [error, info])

  return (
    <div className={classes.root}>
      <IconErrorOutline fontSize="small" />
      <div className={classes.message}>
        <M.Typography variant="body2">Toolbar error occurred</M.Typography>
      </div>
      <M.IconButton size="small" onClick={reset} color="inherit">
        <IconRefresh fontSize="small" />
      </M.IconButton>
    </div>
  )
}

const ToolbarErrorBoundary = createBoundary(
  (_: unknown, { reset }: { reset: () => void }) =>
    (error: Error, info: any) => (
      <ToolbarErrorBoundaryPlaceholder error={error} info={info} reset={reset} />
    ),
)

export default ToolbarErrorBoundary
