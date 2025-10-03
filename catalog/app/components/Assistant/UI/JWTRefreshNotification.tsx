/**
 * JWTRefreshNotification
 *
 * Displays a notification when JWT validation errors are detected
 * and provides options to refresh the token automatically.
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import * as icons from '@material-ui/icons'

const useStyles = M.makeStyles((theme) => ({
  successPaper: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: '#e8f5e9',
    border: '1px solid #4caf50',
  },
  warningPaper: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: '#fff3e0',
    border: '1px solid #ff9800',
  },
  flexRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  flexColumn: {
    flex: 1,
  },
  errorBox: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: '#ffebee',
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #f44336',
  },
  buttonGroup: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  accordion: {
    marginTop: theme.spacing(2),
  },
  successIcon: {
    color: '#4caf50',
  },
  warningIcon: {
    color: '#f57c00',
    marginTop: theme.spacing(0.5),
  },
  successTitle: {
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  successText: {
    marginTop: theme.spacing(1),
    color: '#2e7d32',
  },
  warningTitle: {
    fontWeight: 'bold',
    color: '#e65100',
  },
  warningText: {
    marginTop: theme.spacing(1),
    color: '#5d4037',
  },
  errorTitle: {
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: theme.spacing(0.5),
  },
  errorText: {
    color: '#c62828',
  },
}))

interface Props {
  onRefresh?: () => Promise<void>
  onDismiss?: () => void
}

export function JWTRefreshNotification({ onRefresh, onDismiss }: Props) {
  const classes = useStyles()
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [refreshSuccess, setRefreshSuccess] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState<string | null>(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)

    try {
      // Try to refresh via auth manager
      if (typeof window !== 'undefined' && (window as any).__dynamicAuthManager) {
        const authManager = (window as any).__dynamicAuthManager
        await authManager.clearCache()
        await authManager.refreshToken()

        setRefreshSuccess(true)

        // Call optional refresh callback
        if (onRefresh) {
          await onRefresh()
        }

        // Auto-dismiss after success
        setTimeout(() => {
          if (onDismiss) onDismiss()
        }, 3000)
      } else {
        throw new Error('Auth manager not available')
      }
    } catch (error: any) {
      setRefreshError(error.message || 'Failed to refresh token')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleHardRefresh = () => {
    // Hard refresh the page to get new config/tokens
    window.location.reload()
  }

  if (refreshSuccess) {
    return (
      <M.Paper elevation={3} className={classes.successPaper}>
        <M.Box className={classes.flexRow}>
          <icons.CheckCircle className={classes.successIcon} />
          <M.Typography variant="body1" className={classes.successTitle}>
            ✅ Token Refreshed Successfully
          </M.Typography>
        </M.Box>
        <M.Typography variant="body2" className={classes.successText}>
          Your authentication token has been refreshed. MCP tools should now work
          correctly.
        </M.Typography>
      </M.Paper>
    )
  }

  return (
    <M.Paper elevation={3} className={classes.warningPaper}>
      <M.Box display="flex" alignItems="flex-start">
        <icons.Warning className={classes.warningIcon} />
        <M.Box className={classes.flexColumn} style={{ marginLeft: 8 }}>
          <M.Typography variant="body1" className={classes.warningTitle}>
            ⚠️ Authentication Token Issue Detected
          </M.Typography>

          <M.Typography variant="body2" className={classes.warningText}>
            Your authentication token may be using an outdated JWT secret. This can cause
            MCP tool calls to fail with "JWT verification" errors.
          </M.Typography>

          {refreshError && (
            <M.Box className={classes.errorBox}>
              <M.Typography variant="body2" className={classes.errorTitle}>
                Refresh Failed
              </M.Typography>
              <M.Typography variant="body2" className={classes.errorText}>
                {refreshError}
              </M.Typography>
            </M.Box>
          )}

          <M.Box className={classes.buttonGroup}>
            <M.Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleRefresh}
              disabled={isRefreshing}
              startIcon={
                isRefreshing ? <M.CircularProgress size={16} /> : <icons.Refresh />
              }
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
            </M.Button>

            <M.Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={handleHardRefresh}
              disabled={isRefreshing}
              startIcon={<icons.Cached />}
            >
              Hard Refresh Page
            </M.Button>

            {onDismiss && (
              <M.Button
                variant="text"
                size="small"
                onClick={onDismiss}
                disabled={isRefreshing}
              >
                Dismiss
              </M.Button>
            )}
          </M.Box>

          <M.Accordion className={classes.accordion}>
            <M.AccordionSummary expandIcon={<icons.ExpandMore />}>
              <M.Typography variant="body2">
                <icons.Info
                  style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}
                />
                More Information
              </M.Typography>
            </M.AccordionSummary>
            <M.AccordionDetails>
              <M.Typography variant="body2" component="div">
                <strong>What happened?</strong>
                <ul>
                  <li>The backend was updated with a new JWT secret</li>
                  <li>
                    Your browser may have cached an old token signed with the previous
                    secret
                  </li>
                  <li>The backend is rejecting the old token signature</li>
                </ul>

                <strong>Solutions:</strong>
                <ol>
                  <li>
                    <strong>Automatic:</strong> Click "Refresh Token" above to regenerate
                    with the new secret
                  </li>
                  <li>
                    <strong>Manual:</strong> Click "Hard Refresh Page" to reload
                    everything from the server
                  </li>
                  <li>
                    <strong>Alternative:</strong> Clear your browser cache and reload (
                    <code>Ctrl+Shift+R</code> or <code>Cmd+Shift+R</code>)
                  </li>
                </ol>

                <strong>Expected Result:</strong>
                <ul>
                  <li>✅ No more "JWT verification failed" errors</li>
                  <li>✅ MCP tools work correctly</li>
                  <li>✅ Bucket access and operations function normally</li>
                </ul>
              </M.Typography>
            </M.AccordionDetails>
          </M.Accordion>
        </M.Box>

        {onDismiss && (
          <M.IconButton size="small" onClick={onDismiss} disabled={isRefreshing}>
            <icons.Close fontSize="small" />
          </M.IconButton>
        )}
      </M.Box>
    </M.Paper>
  )
}

/**
 * Hook to detect JWT validation errors and show notification
 */
export function useJWTErrorDetection() {
  const [showNotification, setShowNotification] = React.useState(false)
  const [errorCount, setErrorCount] = React.useState(0)

  React.useEffect(() => {
    // Check auth manager for JWT validation errors
    const checkErrors = () => {
      if (typeof window !== 'undefined' && (window as any).__dynamicAuthManager) {
        const authManager = (window as any).__dynamicAuthManager
        const stats = authManager.getJWTValidationStats?.()

        if (stats && stats.validationFailureCount > 0) {
          setErrorCount(stats.validationFailureCount)
          setShowNotification(true)
        }
      }
    }

    // Check immediately
    checkErrors()

    // Check periodically
    const interval = setInterval(checkErrors, 5000)

    return () => clearInterval(interval)
  }, [])

  const dismissNotification = () => {
    setShowNotification(false)
  }

  const resetErrors = async () => {
    if (typeof window !== 'undefined' && (window as any).__dynamicAuthManager) {
      const authManager = (window as any).__dynamicAuthManager
      if (authManager.jwtValidator?.resetStats) {
        authManager.jwtValidator.resetStats()
      }
    }
    setErrorCount(0)
    setShowNotification(false)
  }

  return {
    showNotification,
    errorCount,
    dismissNotification,
    resetErrors,
  }
}
