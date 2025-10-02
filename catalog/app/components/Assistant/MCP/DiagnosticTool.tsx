/**
 * Diagnostic Tool for MCP Authentication Issues
 *
 * This component helps diagnose authentication and access issues with the MCP server.
 */

import React, { useState, useEffect } from 'react'
import { mcpClient } from './Client'

interface DiagnosticResult {
  test: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message?: string
  data?: any
  timestamp?: string
}

export function DiagnosticTool() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addResult = (
    test: string,
    status: DiagnosticResult['status'],
    message?: string,
    data?: any,
  ) => {
    setResults((prev) => [
      ...prev,
      {
        test,
        status,
        message,
        data,
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const runDiagnostics = async () => {
    setIsRunning(true)
    setResults([])

    try {
      // Test 1: Check MCP Client Status
      addResult('MCP Client Status', 'running')
      try {
        const hasSession = mcpClient.hasSession()
        const isAuth = mcpClient.isAuthenticated()
        addResult(
          'MCP Client Status',
          'passed',
          `Session: ${hasSession}, Authenticated: ${isAuth}`,
        )
      } catch (error) {
        addResult(
          'MCP Client Status',
          'failed',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 2: Check Authentication Status
      addResult('Authentication Status', 'running')
      try {
        const authStatus = await mcpClient.getAuthenticationStatus()
        addResult('Authentication Status', 'passed', 'Auth status retrieved', authStatus)
      } catch (error) {
        addResult(
          'Authentication Status',
          'failed',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 3: Check Token Retrieval
      addResult('Token Retrieval', 'running')
      try {
        const token = await mcpClient.getAccessToken()
        if (token) {
          // Decode token to check contents
          const parts = token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(
              atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)),
            )
            addResult('Token Retrieval', 'passed', 'Token retrieved and decoded', {
              hasToken: true,
              tokenLength: token.length,
              payload: payload,
            })
          } else {
            addResult('Token Retrieval', 'failed', 'Invalid token format')
          }
        } else {
          addResult('Token Retrieval', 'failed', 'No token available')
        }
      } catch (error) {
        addResult(
          'Token Retrieval',
          'failed',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 4: Check Role Information
      addResult('Role Information', 'running')
      try {
        const roleInfo = mcpClient.getRoleInfo()
        addResult('Role Information', 'passed', 'Role info retrieved', roleInfo)
      } catch (error) {
        addResult(
          'Role Information',
          'failed',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 5: Test MCP Server Connection
      addResult('MCP Server Connection', 'running')
      try {
        const tools = await mcpClient.listAvailableTools()
        addResult(
          'MCP Server Connection',
          'passed',
          `Connected to MCP server, ${tools.length} tools available`,
          tools,
        )
      } catch (error) {
        addResult(
          'MCP Server Connection',
          'failed',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // Test 6: Test Bucket Access (if MCP tools are available)
      addResult('Bucket Access Test', 'running')
      try {
        // Try to use a bucket-related MCP tool if available
        const tools = await mcpClient.listAvailableTools()
        const bucketTool = tools.find(
          (tool) =>
            tool.name.includes('bucket') ||
            tool.name.includes('list') ||
            tool.name.includes('s3'),
        )

        if (bucketTool) {
          try {
            const result = await mcpClient.executeTool(bucketTool.name, {})
            addResult(
              'Bucket Access Test',
              'passed',
              `Bucket tool executed successfully`,
              result,
            )
          } catch (toolError) {
            addResult(
              'Bucket Access Test',
              'failed',
              `Bucket tool execution failed: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
            )
          }
        } else {
          addResult(
            'Bucket Access Test',
            'passed',
            'No bucket-specific tools found, but MCP connection works',
          )
        }
      } catch (error) {
        addResult(
          'Bucket Access Test',
          'failed',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    } catch (error) {
      addResult(
        'Diagnostic Error',
        'failed',
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsRunning(false)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  const exportResults = () => {
    const dataStr = JSON.stringify(results, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mcp-diagnostic-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px' }}>
      <h2>🔧 MCP Authentication Diagnostic Tool</h2>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            backgroundColor: isRunning ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            marginRight: '10px',
          }}
        >
          {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
        </button>

        <button
          onClick={clearResults}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
          }}
        >
          Clear Results
        </button>

        <button
          onClick={exportResults}
          disabled={results.length === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: results.length === 0 ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: results.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Export Results
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>📊 Diagnostic Summary</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                padding: '10px',
                backgroundColor: '#d4edda',
                borderRadius: '4px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'green' }}>
                {results.filter((r) => r.status === 'passed').length}
              </div>
              <div>Passed</div>
            </div>
            <div
              style={{
                padding: '10px',
                backgroundColor: '#f8d7da',
                borderRadius: '4px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'red' }}>
                {results.filter((r) => r.status === 'failed').length}
              </div>
              <div>Failed</div>
            </div>
            <div
              style={{
                padding: '10px',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'orange' }}>
                {results.filter((r) => r.status === 'running').length}
              </div>
              <div>Running</div>
            </div>
          </div>
        </div>
      )}

      {results.map((result, index) => (
        <div
          key={index}
          style={{
            marginBottom: '10px',
            padding: '15px',
            backgroundColor:
              result.status === 'passed'
                ? '#d4edda'
                : result.status === 'failed'
                  ? '#f8d7da'
                  : result.status === 'running'
                    ? '#fff3cd'
                    : '#f8f9fa',
            borderRadius: '4px',
            border: `1px solid ${
              result.status === 'passed'
                ? '#c3e6cb'
                : result.status === 'failed'
                  ? '#f5c6cb'
                  : result.status === 'running'
                    ? '#ffeaa7'
                    : '#dee2e6'
            }`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ marginRight: '10px', fontSize: '18px' }}>
              {result.status === 'passed'
                ? '✅'
                : result.status === 'failed'
                  ? '❌'
                  : result.status === 'running'
                    ? '🔄'
                    : '⏳'}
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{result.test}</span>
            {result.timestamp && (
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
                {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          {result.message && (
            <div style={{ marginBottom: '8px', fontSize: '14px' }}>{result.message}</div>
          )}

          {result.data && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                View Data
              </summary>
              <pre
                style={{
                  marginTop: '8px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '300px',
                }}
              >
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}

      {isRunning && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            color: '#856404',
            textAlign: 'center',
          }}
        >
          🔄 Running diagnostics... Please wait.
        </div>
      )}
    </div>
  )
}

export default DiagnosticTool
