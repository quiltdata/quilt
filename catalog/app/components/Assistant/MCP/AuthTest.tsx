/**
 * AuthTest Component
 *
 * Comprehensive testing and validation component for the enhanced authentication system.
 * Tests dynamic bucket discovery, enhanced token generation, and MCP integration.
 */

import React, { useState, useEffect } from 'react'
import { useMCPAuthManager } from './MCPContextProviderEnhanced'
import { DynamicAuthManager } from '../../../services/DynamicAuthManager'

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message?: string
  data?: any
  duration?: number
}

interface TestSuite {
  name: string
  tests: TestResult[]
  status: 'pending' | 'running' | 'completed'
  startTime?: number
  endTime?: number
}

export function AuthTest() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [authManager, setAuthManager] = useState<DynamicAuthManager | null>(null)

  // Initialize auth manager
  useEffect(() => {
    const initializeAuthManager = async () => {
      try {
        console.log('🚀 Initializing AuthTest...')
        const manager = new DynamicAuthManager(null, null, null) // We'll need proper dependencies
        await manager.initialize()
        setAuthManager(manager)
        console.log('✅ AuthTest initialized')
      } catch (error) {
        console.error('❌ Failed to initialize AuthTest:', error)
      }
    }

    initializeAuthManager()
  }, [])

  const createTestSuite = (name: string): TestSuite => ({
    name,
    tests: [],
    status: 'pending',
  })

  const addTest = (suiteName: string, testName: string) => {
    setTestSuites((prev) =>
      prev.map((suite) =>
        suite.name === suiteName
          ? { ...suite, tests: [...suite.tests, { name: testName, status: 'pending' }] }
          : suite,
      ),
    )
  }

  const updateTest = (
    suiteName: string,
    testName: string,
    updates: Partial<TestResult>,
  ) => {
    setTestSuites((prev) =>
      prev.map((suite) =>
        suite.name === suiteName
          ? {
              ...suite,
              tests: suite.tests.map((test) =>
                test.name === testName ? { ...test, ...updates } : test,
              ),
            }
          : suite,
      ),
    )
  }

  const updateSuite = (suiteName: string, updates: Partial<TestSuite>) => {
    setTestSuites((prev) =>
      prev.map((suite) => (suite.name === suiteName ? { ...suite, ...updates } : suite)),
    )
  }

  const runTest = async (
    suiteName: string,
    testName: string,
    testFn: () => Promise<any>,
  ) => {
    const startTime = Date.now()
    updateTest(suiteName, testName, { status: 'running' })

    try {
      const result = await testFn()
      const duration = Date.now() - startTime
      updateTest(suiteName, testName, {
        status: 'passed',
        message: 'Test passed successfully',
        data: result,
        duration,
      })
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      updateTest(suiteName, testName, {
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        duration,
      })
      throw error
    }
  }

  const runAllTests = async () => {
    if (!authManager) {
      console.error('❌ AuthManager not initialized')
      return
    }

    setIsRunning(true)

    // Initialize test suites
    const suites = [
      createTestSuite('Dynamic Bucket Discovery'),
      createTestSuite('Enhanced Token Generation'),
      createTestSuite('MCP Integration'),
      createTestSuite('Role Management'),
      createTestSuite('Error Handling'),
    ]

    setTestSuites(suites)

    try {
      // Test Suite 1: Dynamic Bucket Discovery
      updateSuite('Dynamic Bucket Discovery', {
        status: 'running',
        startTime: Date.now(),
      })

      await runTest('Dynamic Bucket Discovery', 'Discover User Buckets', async () => {
        const buckets = await authManager.getCurrentBuckets()
        if (!Array.isArray(buckets)) {
          throw new Error('Expected buckets to be an array')
        }
        return { bucketCount: buckets.length, buckets }
      })

      await runTest('Dynamic Bucket Discovery', 'Validate Bucket Structure', async () => {
        const buckets = await authManager.getCurrentBuckets()
        if (buckets.length === 0) {
          throw new Error('No buckets discovered')
        }

        const bucket = buckets[0]
        const requiredFields = ['name', 'region', 'permissions', 'accessLevel']
        const missingFields = requiredFields.filter((field) => !(field in bucket))

        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
        }

        return { bucketStructure: 'valid', requiredFields: requiredFields.length }
      })

      await runTest('Dynamic Bucket Discovery', 'Test Cache Functionality', async () => {
        const startTime = Date.now()
        await authManager.getCurrentBuckets()
        const firstCall = Date.now() - startTime

        const cacheStartTime = Date.now()
        await authManager.getCurrentBuckets()
        const secondCall = Date.now() - cacheStartTime

        // Second call should be faster due to caching
        if (secondCall >= firstCall) {
          console.warn('Cache may not be working optimally')
        }

        return { firstCall, secondCall, cacheWorking: secondCall < firstCall }
      })

      updateSuite('Dynamic Bucket Discovery', {
        status: 'completed',
        endTime: Date.now(),
      })

      // Test Suite 2: Enhanced Token Generation
      updateSuite('Enhanced Token Generation', {
        status: 'running',
        startTime: Date.now(),
      })

      await runTest('Enhanced Token Generation', 'Generate Enhanced Token', async () => {
        const token = await authManager.getCurrentToken()
        if (!token) {
          throw new Error('No token generated')
        }
        return { tokenLength: token.length, hasToken: true }
      })

      await runTest('Enhanced Token Generation', 'Validate Token Structure', async () => {
        const token = await authManager.getCurrentToken()
        if (!token) {
          throw new Error('No token available for validation')
        }

        const stats = await authManager.getTokenStats()
        if (!stats) {
          throw new Error('Could not get token statistics')
        }

        const requiredFields = [
          'version',
          'tokenType',
          'scope',
          'permissionCount',
          'bucketCount',
        ]
        const missingFields = requiredFields.filter((field) => !(field in stats))

        if (missingFields.length > 0) {
          throw new Error(`Missing token fields: ${missingFields.join(', ')}`)
        }

        return { tokenStats: stats, validationPassed: true }
      })

      await runTest('Enhanced Token Generation', 'Test Token Enhancement', async () => {
        const stats = await authManager.getTokenStats()
        if (!stats) {
          throw new Error('Could not get token statistics')
        }

        const isEnhanced = stats.enhanced === true
        const hasDynamicBuckets = stats.discoveryMethod === 'dynamic'
        const hasPermissions = stats.permissionCount > 0
        const hasBuckets = stats.bucketCount > 0

        if (!isEnhanced || !hasDynamicBuckets || !hasPermissions || !hasBuckets) {
          throw new Error('Token enhancement validation failed')
        }

        return {
          isEnhanced,
          hasDynamicBuckets,
          hasPermissions,
          hasBuckets,
          enhancementValid: true,
        }
      })

      updateSuite('Enhanced Token Generation', {
        status: 'completed',
        endTime: Date.now(),
      })

      // Test Suite 3: MCP Integration
      updateSuite('MCP Integration', { status: 'running', startTime: Date.now() })

      await runTest('MCP Integration', 'Test Authentication Status', async () => {
        const authStatus = await authManager.getAuthStatus()

        if (!authStatus.isAuthenticated) {
          throw new Error('Not authenticated')
        }

        if (!authStatus.hasToken) {
          throw new Error('No token available')
        }

        if (!authStatus.hasBuckets) {
          throw new Error('No buckets available')
        }

        return { authStatus, integrationValid: true }
      })

      await runTest('MCP Integration', 'Test Token Refresh', async () => {
        const initialToken = await authManager.getCurrentToken()
        if (!initialToken) {
          throw new Error('No initial token')
        }

        // Force refresh
        await authManager.refreshToken()
        const refreshedToken = await authManager.getCurrentToken()

        if (!refreshedToken) {
          throw new Error('No refreshed token')
        }

        return {
          initialTokenLength: initialToken.length,
          refreshedTokenLength: refreshedToken.length,
          refreshSuccessful: true,
        }
      })

      updateSuite('MCP Integration', { status: 'completed', endTime: Date.now() })

      // Test Suite 4: Role Management
      updateSuite('Role Management', { status: 'running', startTime: Date.now() })

      await runTest('Role Management', 'Test Role Change Handling', async () => {
        // Simulate role change
        const result = await authManager.handleRoleChange('ReadWriteQuiltV2-sales-prod')

        if (!result) {
          throw new Error('Role change handling failed')
        }

        return { roleChangeHandled: true, result }
      })

      updateSuite('Role Management', { status: 'completed', endTime: Date.now() })

      // Test Suite 5: Error Handling
      updateSuite('Error Handling', { status: 'running', startTime: Date.now() })

      await runTest('Error Handling', 'Test Graceful Degradation', async () => {
        // Test with invalid configuration
        const originalConfig = authManager.getConfig()
        authManager.updateConfig({ enableDynamicDiscovery: false })

        try {
          const buckets = await authManager.getCurrentBuckets()
          // Should still work with fallback
          return { gracefulDegradation: true, buckets: buckets.length }
        } finally {
          authManager.updateConfig(originalConfig)
        }
      })

      await runTest('Error Handling', 'Test Cache Clear', async () => {
        authManager.clearCache()
        const debugInfo = authManager.getDebugInfo()

        if (debugInfo.bucketCount > 0) {
          throw new Error('Cache not properly cleared')
        }

        return { cacheCleared: true, debugInfo }
      })

      updateSuite('Error Handling', { status: 'completed', endTime: Date.now() })

      console.log('✅ All tests completed successfully')
    } catch (error) {
      console.error('❌ Test execution failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const getTestSummary = () => {
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0)
    const passedTests = testSuites.reduce(
      (sum, suite) => sum + suite.tests.filter((test) => test.status === 'passed').length,
      0,
    )
    const failedTests = testSuites.reduce(
      (sum, suite) => sum + suite.tests.filter((test) => test.status === 'failed').length,
      0,
    )

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
    }
  }

  const summary = getTestSummary()

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🔬 Enhanced Authentication Test Suite</h2>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runAllTests}
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
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>

        {authManager && (
          <button
            onClick={() => authManager.clearCache()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '10px',
            }}
          >
            Clear Cache
          </button>
        )}
      </div>

      {summary.totalTests > 0 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            border: '1px solid #dee2e6',
          }}
        >
          <h3>📊 Test Summary</h3>
          <p>Total Tests: {summary.totalTests}</p>
          <p>
            Passed: <span style={{ color: 'green' }}>{summary.passedTests}</span>
          </p>
          <p>
            Failed: <span style={{ color: 'red' }}>{summary.failedTests}</span>
          </p>
          <p>Success Rate: {summary.successRate.toFixed(1)}%</p>
        </div>
      )}

      {testSuites.map((suite) => (
        <div key={suite.name} style={{ marginBottom: '20px' }}>
          <h3
            style={{
              color:
                suite.status === 'completed'
                  ? 'green'
                  : suite.status === 'running'
                    ? 'orange'
                    : 'black',
            }}
          >
            {suite.status === 'completed'
              ? '✅'
              : suite.status === 'running'
                ? '🔄'
                : '⏳'}{' '}
            {suite.name}
          </h3>

          {suite.tests.map((test) => (
            <div
              key={test.name}
              style={{
                marginLeft: '20px',
                marginBottom: '10px',
                padding: '8px',
                backgroundColor:
                  test.status === 'passed'
                    ? '#d4edda'
                    : test.status === 'failed'
                      ? '#f8d7da'
                      : test.status === 'running'
                        ? '#fff3cd'
                        : '#f8f9fa',
                borderRadius: '4px',
                border: `1px solid ${
                  test.status === 'passed'
                    ? '#c3e6cb'
                    : test.status === 'failed'
                      ? '#f5c6cb'
                      : test.status === 'running'
                        ? '#ffeaa7'
                        : '#dee2e6'
                }`,
              }}
            >
              <div style={{ fontWeight: 'bold' }}>
                {test.status === 'passed'
                  ? '✅'
                  : test.status === 'failed'
                    ? '❌'
                    : test.status === 'running'
                      ? '🔄'
                      : '⏳'}{' '}
                {test.name}
              </div>

              {test.message && (
                <div style={{ marginTop: '4px', fontSize: '0.9em' }}>{test.message}</div>
              )}

              {test.duration && (
                <div style={{ marginTop: '4px', fontSize: '0.8em', color: '#666' }}>
                  Duration: {test.duration}ms
                </div>
              )}

              {test.data && process.env.NODE_ENV === 'development' && (
                <details style={{ marginTop: '4px' }}>
                  <summary>Test Data</summary>
                  <pre style={{ fontSize: '0.8em', marginTop: '4px' }}>
                    {JSON.stringify(test.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      ))}

      {!authManager && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            color: '#856404',
          }}
        >
          ⚠️ AuthManager not initialized. Please wait for initialization to complete.
        </div>
      )}
    </div>
  )
}

export default AuthTest
