import React, { useState } from 'react'
import { Button, Typography, Box, Paper } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { mcpClient } from './Client'

/**
 * Test component to debug MCP server token reception and permissions
 */
export function MCPServerDebugTest() {
  const [testResults, setTestResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const testMCPServerPermissions = async () => {
    setIsLoading(true)
    setTestResults(null)

    try {
      console.log('🧪 Starting MCP Server Debug Test...')

      // Test 1: Get current authentication status
      const authStatus = await mcpClient.getAuthenticationStatus()
      console.log('🔍 Current Auth Status:', authStatus)

      // Test 2: Get current headers being sent
      const headers = await mcpClient.getHeaders()
      console.log('🔍 Current Headers:', headers)

      // Test 3: Try to list available tools (this should show what the server sees)
      const tools = await mcpClient.listAvailableTools()
      console.log('🔍 Available Tools:', tools)

      // Test 4: Try to call a specific MCP tool that requires permissions
      // This will help us see if the server is recognizing our permissions
      let toolTestResult = null
      try {
        // Try to call a tool that should require S3 permissions
        const toolCall = await mcpClient.callTool({
          name: 'mcp_quilt-mcp-server_list_available_resources',
          arguments: {},
        })
        toolTestResult = { success: true, result: toolCall }
        console.log('✅ Tool call successful:', toolCall)
      } catch (error) {
        toolTestResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
        console.log('❌ Tool call failed:', error)
      }

      // Test 5: Decode the token to see what we're sending
      const token = headers.Authorization?.replace('Bearer ', '')
      let tokenDecoded = null
      if (token) {
        try {
          const tokenParts = token.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(
              atob(tokenParts[1] + '='.repeat((4 - (tokenParts[1].length % 4)) % 4)),
            )
            tokenDecoded = payload
            console.log('🔍 Decoded Token Payload:', payload)
          }
        } catch (error) {
          console.log('❌ Failed to decode token:', error)
        }
      }

      setTestResults({
        authStatus,
        headers,
        tools,
        toolTestResult,
        tokenDecoded,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('❌ MCP Server Debug Test failed:', error)
      setTestResults({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box p={2}>
      <Typography variant="h6" gutterBottom>
        MCP Server Debug Test
      </Typography>

      <Typography variant="body2" color="textSecondary" paragraph>
        This test will verify what the MCP server is receiving and whether it can access
        the enhanced permissions.
      </Typography>

      <Button
        variant="contained"
        color="primary"
        onClick={testMCPServerPermissions}
        disabled={isLoading}
        style={{ marginBottom: 16 }}
      >
        {isLoading ? 'Testing...' : 'Test MCP Server Permissions'}
      </Button>

      {testResults && (
        <Paper style={{ padding: 16, marginTop: 16 }}>
          <Typography variant="h6" gutterBottom>
            Test Results
          </Typography>

          {testResults.error ? (
            <Alert severity="error">
              <Typography variant="body2">
                <strong>Error:</strong> {testResults.error}
              </Typography>
            </Alert>
          ) : (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Authentication Status
              </Typography>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(testResults.authStatus, null, 2)}
              </pre>

              <Typography variant="subtitle1" gutterBottom style={{ marginTop: 16 }}>
                Headers Being Sent
              </Typography>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(testResults.headers, null, 2)}
              </pre>

              <Typography variant="subtitle1" gutterBottom style={{ marginTop: 16 }}>
                Available Tools
              </Typography>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(testResults.tools, null, 2)}
              </pre>

              <Typography variant="subtitle1" gutterBottom style={{ marginTop: 16 }}>
                Tool Test Result
              </Typography>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(testResults.toolTestResult, null, 2)}
              </pre>

              {testResults.tokenDecoded && (
                <>
                  <Typography variant="subtitle1" gutterBottom style={{ marginTop: 16 }}>
                    Decoded Token Claims
                  </Typography>
                  <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                    {JSON.stringify(testResults.tokenDecoded, null, 2)}
                  </pre>
                </>
              )}

              <Typography
                variant="caption"
                color="textSecondary"
                style={{ marginTop: 16, display: 'block' }}
              >
                Test completed at: {testResults.timestamp}
              </Typography>
            </>
          )}
        </Paper>
      )}
    </Box>
  )
}
