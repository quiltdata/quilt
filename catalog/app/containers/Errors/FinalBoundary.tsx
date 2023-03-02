import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { createBoundary } from 'utils/ErrorBoundary'
import { CredentialsError } from 'utils/AWS/Credentials'
import StyledTooltip from 'utils/StyledTooltip'
import logout from 'utils/logout'

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
        <StyledTooltip
          title={
            <>
              <M.Typography>
                By clicking "Restart session" you are signing out.
                in, you will be redirected to the same page.
              </M.Typography>
              <M.Typography>
                Re-logging highly likely will resolve the credentials issue.
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
