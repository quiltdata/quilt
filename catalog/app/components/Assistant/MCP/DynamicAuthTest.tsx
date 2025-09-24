import * as React from 'react'
import { useMCPContextStateValue } from './MCPContextProvider'

export function DynamicAuthTest() {
  const { status, error, authManager } = useMCPContextStateValue()
  const [testResults, setTestResults] = React.useState<any>(null)
  const [isRunning, setIsRunning] = React.useState(false)

  const runTests = async () => {
    if (!authManager) {
      console.log('❌ No authManager available')
      return
    }

    setIsRunning(true)
    const results: any = {}

    try {
      console.log('🧪 Running Dynamic Auth Tests...')

      // Test 1: Get current token
      console.log('Test 1: Getting current token...')
      const token = await authManager.getCurrentToken()
      results.token = token ? '✅ Token retrieved' : '❌ No token'
      console.log('Test 1 result:', results.token)

      // Test 2: Get current buckets
      console.log('Test 2: Getting current buckets...')
      const buckets = await authManager.getCurrentBuckets()
      results.buckets = buckets ? `✅ ${buckets.length} buckets found` : '❌ No buckets'
      results.bucketList = buckets
      console.log('Test 2 result:', results.buckets, buckets)

      // Test 3: Get auth status
      console.log('Test 3: Getting auth status...')
      const authStatus = await authManager.getAuthStatus()
      results.authStatus = authStatus
      console.log('Test 3 result:', authStatus)

      // Test 4: Decode token to check claims
      if (token) {
        console.log('Test 4: Decoding token claims...')
        try {
          const tokenParts = token.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]))
            results.tokenClaims = {
              hasScope: !!payload.scope,
              hasPermissions: !!payload.permissions?.length,
              hasRoles: !!payload.roles?.length,
              hasBuckets: !!payload.buckets?.length,
              scope: payload.scope,
              permissions: payload.permissions,
              roles: payload.roles,
              buckets: payload.buckets,
            }
            console.log('Test 4 result: Token claims decoded', results.tokenClaims)
          } else {
            results.tokenClaims = '❌ Invalid token format'
          }
        } catch (error) {
          results.tokenClaims = `❌ Error decoding token: ${error instanceof Error ? error.message : String(error)}`
        }
      }

      // Test 5: Check if buckets are dynamic
      console.log('Test 5: Checking if buckets are dynamic...')
      const isDynamic = buckets && buckets.length > 0 && buckets.some((b: any) => b.name)
      results.isDynamic = isDynamic
        ? '✅ Dynamic buckets detected'
        : '❌ Static buckets only'
      console.log('Test 5 result:', results.isDynamic)

      setTestResults(results)
      console.log('✅ All tests completed:', results)
    } catch (error) {
      console.error('❌ Test failed:', error)
      results.error = error instanceof Error ? error.message : String(error)
      setTestResults(results)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Dynamic Authentication Test</h3>
      <p>Status: {status}</p>
      {error && (
        <p style={{ color: 'red' }}>
          Error: {typeof error === 'string' ? error : (error as Error).message}
        </p>
      )}

      <button
        onClick={runTests}
        disabled={isRunning || !authManager}
        style={{
          padding: '10px 20px',
          backgroundColor: isRunning ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
        }}
      >
        {isRunning ? 'Running Tests...' : 'Run Dynamic Auth Tests'}
      </button>

      {testResults && (
        <div style={{ marginTop: '20px' }}>
          <h4>Test Results:</h4>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '400px',
            }}
          >
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
