import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { createBoundary } from 'utils/ErrorBoundary'
import { CredentialsError } from 'utils/AWS/Credentials'

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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: t.spacing(4),
  },
  button: {
    marginBottom: t.spacing(2),
  },
  header: {
    color: t.palette.text.primary,
  },
  headerIcon: {
    verticalAlign: '-2px',
  },
}))

interface FinalBoundaryLayoutProps {
  error: Error
}

function FinalBoundaryLayout({ error }: FinalBoundaryLayoutProps) {
  const [disabled, setDisabled] = React.useState(false)
  const classes = useFinalBoundaryStyles()
  const reload = React.useCallback(() => {
    setDisabled(true)
    window.location.reload()
  }, [])
  const onLogout = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      window.localStorage.clear()
      reload()
    },
    [reload],
  )
  const isCredentialsError = error instanceof CredentialsError
  // TODO: use components/Error
  return (
    // the whole container is clickable because easier reload outdated page is better
    <div className={classes.root} onClick={reload}>
      <M.Typography variant="h4" className={classes.header}>
        {isCredentialsError ? (
          <>
            <M.Icon fontSize="large" className={classes.headerIcon}>
              no_encryption
            </M.Icon>{' '}
            {error.headline}
          </>
        ) : (
          'Something went wrong'
        )}
      </M.Typography>
      <div className={classes.actions}>
        <M.Button
          className={classes.button}
          disabled={disabled}
          startIcon={<M.Icon>refresh</M.Icon>}
          variant="contained"
        >
          Reload
        </M.Button>
        <M.Button
          className={classes.button}
          disabled={disabled}
          onClick={onLogout}
          startIcon={<M.Icon>power_settings_new</M.Icon>}
          variant="outlined"
        >
          Restart session
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
