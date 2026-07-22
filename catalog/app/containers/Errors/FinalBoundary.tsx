import cx from 'classnames'
import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as style from 'constants/style'
import { CredentialsError } from 'utils/AWS/Credentials'
import logout from 'utils/logout'
import mkStorage from 'utils/storage'

const storage = mkStorage({
  reloadAttempt: 'RELOAD_ATTEMPT',
})

const RELOAD_ATTEMPT_LIFESPAN = 1000 * 60 * 5

const lastReloadAttempt = storage.get('reloadAttempt')

const useFinalBoundaryStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    // Explicit midnight ground (matches the global html/body background in
    // global-styles.tsx) rather than relying on a dark-type theme's
    // background.default — this screen no longer sits inside navTheme.
    backgroundColor: t.palette.primary.main,
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
  restartButton: {
    // The default outlined Button reads theme.palette.text.primary / a
    // type-aware border color, both of which flip to dark-on-dark now that
    // this screen renders under appTheme. Pin them to stay legible on the
    // explicit midnight ground above.
    color: fade(t.palette.common.white, 0.85),
    borderColor: fade(t.palette.common.white, 0.23),
  },
  header: {
    // Was theme.palette.text.primary, which navTheme overrode to a light
    // color for legibility on dark. Pinned explicitly now that this screen
    // renders under appTheme (light-type default text.primary is near-black).
    color: fade(t.palette.common.white, 0.85),
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

  const reloadDidntHelp = lastReloadAttempt
    ? Date.now() - lastReloadAttempt < RELOAD_ATTEMPT_LIFESPAN
    : false

  React.useEffect(() => {
    if (!lastReloadAttempt || reloadDidntHelp) return
    storage.remove('reloadAttempt')
  }, [reloadDidntHelp])

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
          <M.Tooltip
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
              className={cx(classes.button, classes.restartButton)}
              disabled={disabled}
              onClick={onLogout}
              startIcon={<M.Icon>power_settings_new</M.Icon>}
              variant="outlined"
            >
              Restart session
            </M.Button>
          </M.Tooltip>
        )}
      </div>
    </M.Container>
  )
}

const FallbackComponent = ({ error }: FallbackProps) => (
  <M.MuiThemeProvider theme={style.appTheme}>
    <FinalBoundaryLayout error={error} />
  </M.MuiThemeProvider>
)

const FinalBoundary = ({ children }: React.PropsWithChildren<{}>) => (
  <ErrorBoundary {...{ children, FallbackComponent }} />
)

export default FinalBoundary
