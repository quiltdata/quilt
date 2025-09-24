/**
 * OAuth Login Button Component
 */
/* eslint-disable no-console */

import React from 'react'
import { Button, CircularProgress } from '@material-ui/core'
import { LockOpen, Lock } from '@material-ui/icons'

import { mcpClient } from './Client'

interface OAuthLoginButtonProps {
  onAuthStateChange?: (isAuthenticated: boolean) => void
  className?: string
}

export const OAuthLoginButton: React.FC<OAuthLoginButtonProps> = ({
  onAuthStateChange,
  className,
}) => {
  const [isLoading, setIsLoading] = React.useState(false)
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)

  React.useEffect(() => {
    // Check initial authentication state
    setIsAuthenticated(mcpClient.isAuthenticated())
  }, [])

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      const authUrl = await mcpClient.startOAuthFlow()
      // Redirect to OAuth provider
      window.location.href = authUrl
    } catch (error) {
      console.error('❌ OAuth login failed:', error)
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    mcpClient.logout()
    setIsAuthenticated(false)
    onAuthStateChange?.(false)
  }

  if (isAuthenticated) {
    return (
      <Button
        variant="outlined"
        color="secondary"
        startIcon={<Lock />}
        onClick={handleLogout}
        className={className}
      >
        Logout
      </Button>
    )
  }

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={isLoading ? <CircularProgress size={16} /> : <LockOpen />}
      onClick={handleLogin}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? 'Connecting...' : 'Login with Quilt'}
    </Button>
  )
}

export default OAuthLoginButton
