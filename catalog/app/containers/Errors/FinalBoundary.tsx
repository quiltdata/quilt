import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { createBoundary } from 'utils/ErrorBoundary'
import { CredentialsError } from 'utils/AWS/Credentials'
import StyledTooltip from 'utils/StyledTooltip'
import logout from 'utils/logout'
import mkStorage from 'utils/storage'

const storage = mkStorage({
  reloadAttempt: 'FAIL_RELOAD_ATTEMPT',
})

const RELOAD_ATTEMPT_LIFESPAN = 1000 * 60 * 5

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
    storage.set('reloadAttempt', Date.now())
    setDisabled(true)
    window.location.reload()
  }, [])

  const [reloadDidntHelp, setReloadDidntHelp] = React.useState(false)
  React.useEffect(() => {
    const lastReloadAttempt = storage.get('reloadAttempt')
    if (!lastReloadAttempt) return
    if (Date.now() - lastReloadAttempt < RELOAD_ATTEMPT_LIFESPAN) {
      setReloadDidntHelp(true)
    } else {
      storage.remove('reloadAttempt')
    }
  }, [])

  const onLogout = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDisabled(true)
    logout(true)
  }, [])
  const isCredentialsError = error instanceof CredentialsError
  // TODO: use components/Error
  return (
    // the whole container is clickable because easier reload outdated page is better
    <M.Container maxWidth="md" className={classes.root} onClick={reload}>
      {isCredentialsError ? (
        <>
          <M.Typography variant="h4" className={classes.header}>
            <M.Icon fontSize="large" className={classes.headerIcon}>
              no_encryption
            </M.Icon>{' '}
            S3 credentials error
          </M.Typography>
          <M.Typography variant="body1" className={classes.header}>
            {error.headline}
          </M.Typography>
        </>
      ) : (
        <M.Typography variant="h4" className={classes.header}>
          'Something went wrong'
        </M.Typography>
      )}
      <div className={classes.actions}>
        <M.Button
          className={classes.button}
          disabled={disabled}
          startIcon={<M.Icon>refresh</M.Icon>}
          variant="contained"
        >
          Reload page
        </M.Button>
        {reloadDidntHelp && (
          <StyledTooltip
            title={
              <>
                <M.Typography>
                  By clicking "Restart session" you are signing out. You will be
                  redirected back to the current page after signing back in.
                </M.Typography>
                <M.Typography>
                  Signing in anew solves the credentials issue in most cases.
                </M.Typography>
              </>
            }
          >
            <M.Button
              className={classes.button}
              disabled={disabled}
              onClick={onLogout}
              startIcon={<M.Icon>power_settings_new</M.Icon>}
              variant="outlined"
            >
              Restart session
            </M.Button>
          </StyledTooltip>
        )}
      </div>
    </M.Container>
  )
}

const FinalBoundary = createBoundary(() => (error: Error /* , info */) => (
  <M.MuiThemeProvider theme={style.navTheme}>
    <FinalBoundaryLayout error={error} />
  </M.MuiThemeProvider>
))

export default FinalBoundary
