import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { createBoundary } from 'utils/ErrorBoundary'
import { ErrorCredentials } from 'utils/error'

const useFinalBoundaryStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: '90vh',
    justifyContent: 'center',
    maxHeight: '600px',
  },
  actions: {
    marginTop: t.spacing(2),
  },
  header: {
    color: t.palette.text.primary,
  },
}))

interface FinalBoundaryLayoutProps {
  error: Error
}

function FinalBoundaryLayout({ error }: FinalBoundaryLayoutProps) {
  const classes = useFinalBoundaryStyles()
  const onClick = () => window.location.reload()
  const isCredentialsError = error instanceof ErrorCredentials
  const title = isCredentialsError
    ? 'Refresh session (secure tokens expired)'
    : 'Something went wrong'
  // TODO: use components/Error
  return (
    // the whole container is clickable because easier reload outdated page is better
    <div className={classes.root} onClick={onClick}>
      <M.Typography variant="h4" className={classes.header}>
        {title}
      </M.Typography>
      <div className={classes.actions}>
        <M.Button startIcon={<M.Icon>refresh</M.Icon>} variant="outlined">
          Reload page
        </M.Button>
      </div>
    </div>
  )
}

const FinalBoundary = createBoundary(() => (error: Error /* , info */) => (
  <M.MuiThemeProvider theme={style.navTheme}>
    <FinalBoundaryLayout error={error} />
  </M.MuiThemeProvider>
))

export default FinalBoundary
