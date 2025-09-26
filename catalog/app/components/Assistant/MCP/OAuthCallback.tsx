/**
 * OAuth Callback Component
 */
/* eslint-disable no-console */

import React from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { Box, Typography, CircularProgress, Paper } from '@material-ui/core'

import { mcpClient } from './Client'

export const OAuthCallback: React.FC = () => {
  const history = useHistory()
  const location = useLocation()
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract code and state from URL parameters
        const urlParams = new URLSearchParams(location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        const errorParam = urlParams.get('error')

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`)
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter')
        }

        console.log('🔐 Handling OAuth callback...')

        // Exchange code for token
        await mcpClient.handleOAuthCallback(code, state)

        setStatus('success')
        console.log('✅ OAuth authentication successful')

        // Redirect to main app after a brief delay
        setTimeout(() => {
          history.push('/')
        }, 2000)
      } catch (error) {
        console.error('❌ OAuth callback failed:', error)
        setError(error instanceof Error ? error.message : 'Authentication failed')
        setStatus('error')
      }
    }

    handleCallback()
  }, [location.search, history])

  if (status === 'loading') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="50vh"
        style={{ gap: 16 }}
      >
        <CircularProgress size={48} />
        <Typography variant="h6">Completing authentication...</Typography>
        <Typography variant="body2" color="textSecondary">
          Please wait while we verify your credentials
        </Typography>
      </Box>
    )
  }

  if (status === 'error') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="50vh"
        style={{ gap: 16 }}
      >
        <Paper
          elevation={3}
          style={{ padding: 24, maxWidth: 400, backgroundColor: '#ffebee' }}
        >
          <Typography variant="h6" color="error">
            Authentication Failed
          </Typography>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Paper>
        <Typography variant="body2" color="textSecondary">
          You can close this window and try again
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="50vh"
      style={{ gap: 16 }}
    >
      <Typography variant="h6" color="primary">
        ✅ Authentication Successful!
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Redirecting you back to the application...
      </Typography>
    </Box>
  )
}

export default OAuthCallback
