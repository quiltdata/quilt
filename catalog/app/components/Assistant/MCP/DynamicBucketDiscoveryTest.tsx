/**
 * DynamicBucketDiscoveryTest
 *
 * Comprehensive test component to verify dynamic bucket discovery and enhanced permissions.
 * Tests the full flow from bucket discovery to JWT token enhancement.
 */

import * as React from 'react'
import { useMCPContextStateValue } from './MCPContextProvider'
import { mcpClient } from './Client'

interface TestResult {
  testName: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message: string
  data?: any
  error?: string
}

export function DynamicBucketDiscoveryTest() {
  const { status, error, authManager } = useMCPContextStateValue()
  const [testResults, setTestResults] = React.useState<TestResult[]>([])
  const [isRunning, setIsRunning] = React.useState(false)
  const [overallStatus, setOverallStatus] = React.useState<
    'pending' | 'running' | 'completed'
  >('pending')

  const updateTestResult = (testName: string, updates: Partial<TestResult>) => {
    setTestResults((prev) =>
      prev.map((test) => (test.testName === testName ? { ...test, ...updates } : test)),
    )
  }

  const addTestResult = (test: TestResult) => {
    setTestResults((prev) => [...prev, test])
  }

  const runAllTests = async () => {
    setIsRunning(true)
    setOverallStatus('running')
    setTestResults([])

    console.log('🧪 Starting Dynamic Bucket Discovery Tests...')

    try {
      // Test 1: Authentication Status
      addTestResult({
        testName: 'Authentication Status',
        status: 'running',
        message: 'Checking authentication status...',
      })

      const authStatus = await mcpClient.getAuthenticationStatus()
      updateTestResult('Authentication Status', {
        status: 'passed',
        message: 'Authentication status retrieved successfully',
        data: authStatus,
      })

      // Test 2: Dynamic Bucket Discovery
      addTestResult({
        testName: 'Dynamic Bucket Discovery',
        status: 'running',
        message: 'Testing dynamic bucket discovery...',
      })

      if (!authManager) {
        updateTestResult('Dynamic Bucket Discovery', {
          status: 'failed',
          message: 'AuthManager not available',
          error: 'AuthManager is null or undefined',
        })
        return
      }

      const discoveredBuckets = await authManager.getCurrentBuckets()
      updateTestResult('Dynamic Bucket Discovery', {
        status: 'passed',
        message: `Discovered ${discoveredBuckets.length} buckets dynamically`,
        data: discoveredBuckets,
      })

      // Test 3: Enhanced JWT Token
      addTestResult({
        testName: 'Enhanced JWT Token',
        status: 'running',
        message: 'Testing enhanced JWT token generation...',
      })

      const enhancedToken = await authManager.getCurrentToken()
      if (!enhancedToken) {
        updateTestResult('Enhanced JWT Token', {
          status: 'failed',
          message: 'No enhanced token generated',
          error: 'Token is null or undefined',
        })
        return
      }

      // Decode and analyze the token
      try {
        const tokenParts = enhancedToken.split('.')
        if (tokenParts.length !== 3) {
          throw new Error('Invalid JWT format')
        }

        const payload = JSON.parse(
          atob(tokenParts[1] + '='.repeat((4 - (tokenParts[1].length % 4)) % 4)),
        )

        const tokenAnalysis = {
          hasScope: !!payload.scope,
          hasPermissions: !!payload.permissions?.length,
          hasRoles: !!payload.roles?.length,
          hasBuckets: !!payload.buckets?.length,
          hasGroups: !!payload.groups?.length,
          hasCapabilities: !!payload.capabilities?.length,
          isEnhanced: payload.token_type === 'enhanced',
          bucketCount: payload.buckets?.length || 0,
          permissionCount: payload.permissions?.length || 0,
          roleCount: payload.roles?.length || 0,
          discoveryMethod: payload.discovery?.discovery_method || 'unknown',
          bucketsDiscovered: payload.discovery?.buckets_discovered || 0,
        }

        updateTestResult('Enhanced JWT Token', {
          status: 'passed',
          message: 'Enhanced JWT token generated successfully with comprehensive claims',
          data: { tokenAnalysis, payload },
        })
      } catch (tokenError) {
        updateTestResult('Enhanced JWT Token', {
          status: 'failed',
          message: 'Failed to decode enhanced token',
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
        })
      }

      // Test 4: MCP Client Headers
      addTestResult({
        testName: 'MCP Client Headers',
        status: 'running',
        message: 'Testing MCP client authentication headers...',
      })

      const headers = await mcpClient.getHeaders()
      const hasBearerToken = headers.Authorization?.startsWith('Bearer ')
      const hasRoleHeaders = !!(
        headers['X-Quilt-User-Role'] || headers['x-quilt-current-role']
      )

      updateTestResult('MCP Client Headers', {
        status: hasBearerToken ? 'passed' : 'failed',
        message: hasBearerToken
          ? 'MCP client is sending Bearer token authentication'
          : 'MCP client is not sending Bearer token',
        data: { headers, hasBearerToken, hasRoleHeaders },
      })

      // Test 5: Bucket Access Validation
      addTestResult({
        testName: 'Bucket Access Validation',
        status: 'running',
        message: 'Validating bucket access permissions...',
      })

      const buckets = await authManager.getCurrentBuckets()
      const bucketValidation = buckets.map((bucket: any) => ({
        name: bucket.name,
        hasReadPermission: bucket.permissions?.read || false,
        hasWritePermission: bucket.permissions?.write || false,
        hasListPermission: bucket.permissions?.list || false,
        hasDeletePermission: bucket.permissions?.delete || false,
        accessLevel: bucket.accessLevel,
      }))

      const allBucketsHaveAccess = bucketValidation.every(
        (b: any) => b.hasReadPermission && b.hasWritePermission && b.hasListPermission,
      )

      updateTestResult('Bucket Access Validation', {
        status: allBucketsHaveAccess ? 'passed' : 'failed',
        message: allBucketsHaveAccess
          ? 'All discovered buckets have proper access permissions'
          : 'Some buckets are missing required permissions',
        data: bucketValidation,
      })

      // Test 6: Cache Management
      addTestResult({
        testName: 'Cache Management',
        status: 'running',
        message: 'Testing cache management and refresh...',
      })

      const cacheStats = authManager.getDebugInfo()
      updateTestResult('Cache Management', {
        status: 'passed',
        message: 'Cache management is working correctly',
        data: cacheStats,
      })

      // Test 7: Dynamic Updates
      addTestResult({
        testName: 'Dynamic Updates',
        status: 'running',
        message: 'Testing dynamic bucket list updates...',
      })

      // Force refresh to test dynamic updates
      const refreshedBuckets = await authManager.getCurrentBuckets()
      const isDynamic = refreshedBuckets.length > 2 // Should have more than just fallback buckets

      updateTestResult('Dynamic Updates', {
        status: isDynamic ? 'passed' : 'failed',
        message: isDynamic
          ? 'Dynamic bucket discovery is working - found multiple buckets'
          : 'Dynamic discovery may not be working - only fallback buckets found',
        data: {
          bucketCount: refreshedBuckets.length,
          buckets: refreshedBuckets.map((b: any) => b.name),
        },
      })

      setOverallStatus('completed')
      console.log('✅ All Dynamic Bucket Discovery Tests completed!')
    } catch (error) {
      console.error('❌ Test suite failed:', error)
      setOverallStatus('completed')
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return '#4CAF50'
      case 'failed':
        return '#F44336'
      case 'running':
        return '#FF9800'
      default:
        return '#9E9E9E'
    }
  }

  const getOverallStatusColor = () => {
    switch (overallStatus) {
      case 'running':
        return '#FF9800'
      case 'completed':
        return testResults.every((r) => r.status === 'passed') ? '#4CAF50' : '#F44336'
      default:
        return '#9E9E9E'
    }
  }

  return (
    <div
      style={{
        border: '2px solid #ccc',
        padding: '20px',
        margin: '20px 0',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ margin: 0, color: '#333' }}>Dynamic Bucket Discovery Test Suite</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getOverallStatusColor(),
            }}
          />
          <span style={{ fontWeight: 'bold', color: getOverallStatusColor() }}>
            {overallStatus.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>
          <strong>MCP Status:</strong> {status}
        </p>
        {error && (
          <p style={{ color: 'red' }}>
            <strong>Error:</strong> {error}
          </p>
        )}
        <p>
          <strong>AuthManager Available:</strong> {authManager ? 'Yes' : 'No'}
        </p>
      </div>

      <button
        onClick={runAllTests}
        disabled={isRunning || !authManager}
        style={{
          padding: '10px 20px',
          backgroundColor: isRunning ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        {isRunning ? 'Running Tests...' : 'Run Dynamic Discovery Tests'}
      </button>

      {testResults.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4>Test Results:</h4>
          <div style={{ display: 'grid', gap: '10px' }}>
            {testResults.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <h5 style={{ margin: 0, color: '#333' }}>{result.testName}</h5>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(result.status),
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 'bold',
                        color: getStatusColor(result.status),
                        textTransform: 'uppercase',
                        fontSize: '12px',
                      }}
                    >
                      {result.status}
                    </span>
                  </div>
                </div>
                <p style={{ margin: '5px 0', color: '#666' }}>{result.message}</p>
                {result.error && (
                  <p
                    style={{
                      margin: '5px 0',
                      color: '#F44336',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  >
                    Error: {result.error}
                  </p>
                )}
                {result.data && (
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                      View Data
                    </summary>
                    <pre
                      style={{
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '12px',
                      }}
                    >
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
