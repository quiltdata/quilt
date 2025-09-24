/**
 * Integration Test for Dynamic Authentication and Bucket Discovery
 *
 * This component provides comprehensive testing of the entire dynamic auth flow:
 * - DynamicAuthManager initialization
 * - BucketDiscoveryService integration
 * - Enhanced JWT token generation
 * - MCP client authentication
 * - Real GraphQL queries
 * - Permission validation
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import { ExpandMore as ExpandMoreIcon } from '@material-ui/icons'
import { Alert } from '@material-ui/lab'

import { BucketDiscoveryService } from '../../../services/BucketDiscoveryService'
import { EnhancedTokenGenerator } from '../../../services/EnhancedTokenGenerator'
import { useMCPContextStateValue } from './MCPContextProvider'
import { mcpClient } from './Client'

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message: string
  details?: any
  duration?: number
}

interface TestSuite {
  name: string
  tests: TestResult[]
  overallStatus: 'pending' | 'running' | 'passed' | 'failed'
  startTime?: number
  endTime?: number
}

export function IntegrationTest() {
  const { status, error, authManager } = useMCPContextStateValue()
  const [testSuites, setTestSuites] = React.useState<TestSuite[]>([])
  const [isRunning, setIsRunning] = React.useState(false)
  const [currentTest, setCurrentTest] = React.useState<string | null>(null)

  const runTest = async (
    testName: string,
    testFn: () => Promise<any>,
  ): Promise<TestResult> => {
    const startTime = Date.now()
    setCurrentTest(testName)

    try {
      // eslint-disable-next-line no-console
      console.log(`🧪 Running test: ${testName}`)
      const result = await testFn()
      const duration = Date.now() - startTime

      // eslint-disable-next-line no-console
      console.log(`✅ Test passed: ${testName} (${duration}ms)`)
      return {
        name: testName,
        status: 'passed',
        message: 'Test passed successfully',
        details: result,
        duration,
      }
    } catch (testError) {
      const duration = Date.now() - startTime
      const message = testError instanceof Error ? testError.message : String(testError)

      // eslint-disable-next-line no-console
      console.error(`❌ Test failed: ${testName}`, testError)
      return {
        name: testName,
        status: 'failed',
        message: `Test failed: ${message}`,
        details: testError,
        duration,
      }
    } finally {
      setCurrentTest(null)
    }
  }

  const runTestSuite = async (
    suiteName: string,
    tests: Array<{ name: string; fn: () => Promise<any> }>,
  ) => {
    const suite: TestSuite = {
      name: suiteName,
      tests: tests.map((t) => ({
        name: t.name,
        status: 'pending',
        message: 'Not started',
      })),
      overallStatus: 'running',
      startTime: Date.now(),
    }

    setTestSuites((prev) => [...prev, suite])

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i]
      const result = await runTest(test.name, test.fn)

      setTestSuites((prev) => {
        const updated = [...prev]
        const suiteIndex = updated.findIndex((s) => s.name === suiteName)
        if (suiteIndex >= 0) {
          updated[suiteIndex].tests[i] = result
        }
        return updated
      })
    }

    // Mark suite as complete
    setTestSuites((prev) => {
      const updated = [...prev]
      const suiteIndex = updated.findIndex((s) => s.name === suiteName)
      if (suiteIndex >= 0) {
        const suite = updated[suiteIndex]
        const allPassed = suite.tests.every((t) => t.status === 'passed')
        updated[suiteIndex] = {
          ...suite,
          overallStatus: allPassed ? 'passed' : 'failed',
          endTime: Date.now(),
        }
      }
      return updated
    })
  }

  const runAllTests = async () => {
    if (isRunning) return

    setIsRunning(true)
    setTestSuites([])
    setCurrentTest(null)

    try {
      // Test Suite 1: DynamicAuthManager Tests
      await runTestSuite('DynamicAuthManager Integration', [
        {
          name: 'Initialize DynamicAuthManager',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')
            const isInitialized = await authManager.initialize()
            if (!isInitialized) throw new Error('Failed to initialize DynamicAuthManager')
            return { initialized: true }
          },
        },
        {
          name: 'Get Current Token',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')
            const token = await authManager.getCurrentToken()
            if (!token) throw new Error('No token retrieved from DynamicAuthManager')

            // Validate token format
            const parts = token.split('.')
            if (parts.length !== 3) throw new Error('Invalid JWT format')

            return { tokenLength: token.length, hasValidFormat: true }
          },
        },
        {
          name: 'Get Current Buckets',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')
            const buckets = await authManager.getCurrentBuckets()
            if (!Array.isArray(buckets)) throw new Error('Buckets not returned as array')
            if (buckets.length === 0) throw new Error('No buckets discovered')

            // Validate bucket structure
            const firstBucket = buckets[0]
            const requiredFields = ['name', 'arn', 'permissions', 'accessLevel']
            for (const field of requiredFields) {
              if (!(field in firstBucket)) {
                throw new Error(`Missing required field: ${field}`)
              }
            }

            return { bucketCount: buckets.length, hasValidStructure: true }
          },
        },
        {
          name: 'Refresh All Data',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')
            const result = await authManager.refreshAll()
            if (!result.success) throw new Error('Refresh failed')

            return {
              success: result.success,
              bucketCount: result.bucketCount || 0,
              refreshed: true,
            }
          },
        },
      ])

      // Test Suite 2: Enhanced JWT Token Tests
      await runTestSuite('Enhanced JWT Token Generation', [
        {
          name: 'Decode Enhanced Token',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')
            const token = await authManager.getCurrentToken()
            if (!token) throw new Error('No token available')

            const parts = token.split('.')
            if (parts.length !== 3) throw new Error('Invalid JWT format')

            const payload = JSON.parse(
              atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)),
            )

            // Check for enhanced claims
            const requiredClaims = [
              'scope',
              'permissions',
              'roles',
              'buckets',
              'aud',
              'iss',
            ]
            const missingClaims = requiredClaims.filter((claim) => !(claim in payload))
            if (missingClaims.length > 0) {
              throw new Error(`Missing enhanced claims: ${missingClaims.join(', ')}`)
            }

            return {
              hasEnhancedClaims: true,
              claimsCount: Object.keys(payload).length,
              scope: payload.scope,
              permissionsCount: payload.permissions?.length || 0,
              bucketsCount: payload.buckets?.length || 0,
            }
          },
        },
        {
          name: 'Validate Token Permissions',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')
            const token = await authManager.getCurrentToken()
            if (!token) throw new Error('No token available')

            const parts = token.split('.')
            const payload = JSON.parse(
              atob(parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4)),
            )

            if (!payload.permissions || !Array.isArray(payload.permissions)) {
              throw new Error('Permissions not found or not an array')
            }

            if (payload.permissions.length === 0) {
              throw new Error('No permissions found in token')
            }

            // Check for expected S3 permissions
            const s3Permissions = payload.permissions.filter((p: string) =>
              p.startsWith('s3:'),
            )
            if (s3Permissions.length === 0) {
              throw new Error('No S3 permissions found')
            }

            return {
              totalPermissions: payload.permissions.length,
              s3Permissions: s3Permissions.length,
              hasValidPermissions: true,
            }
          },
        },
      ])

      // Test Suite 3: MCP Client Integration Tests
      await runTestSuite('MCP Client Integration', [
        {
          name: 'MCP Client Authentication Status',
          fn: async () => {
            const authStatus = await mcpClient.getAuthenticationStatus()
            if (!authStatus.hasBearerToken) {
              throw new Error('MCP client does not have bearer token')
            }

            return {
              hasBearerToken: authStatus.hasBearerToken,
              hasReduxToken: authStatus.hasReduxToken,
              authenticationMethod: authStatus.authenticationMethod,
              hasRoleInfo: authStatus.hasRoleInfo,
            }
          },
        },
        {
          name: 'MCP Client Headers',
          fn: async () => {
            const headers = await mcpClient.getHeaders()
            if (!headers.Authorization) {
              throw new Error('No Authorization header found')
            }

            if (!headers.Authorization.startsWith('Bearer ')) {
              throw new Error('Authorization header is not a Bearer token')
            }

            return {
              hasAuthorization: !!headers.Authorization,
              isBearerToken: headers.Authorization.startsWith('Bearer '),
              headerCount: Object.keys(headers).length,
            }
          },
        },
        {
          name: 'MCP Client Session',
          fn: async () => {
            const hasSession = mcpClient.hasSession()
            if (!hasSession) {
              throw new Error('MCP client does not have an active session')
            }

            return { hasSession: true }
          },
        },
      ])

      // Test Suite 4: GraphQL Integration Tests
      await runTestSuite('GraphQL Integration', [
        {
          name: 'Bucket Discovery Service',
          fn: async () => {
            const bucketService = new BucketDiscoveryService()
            const buckets = await bucketService.getAccessibleBuckets({
              token: (await authManager?.getCurrentToken()) || '',
              roles: ['ReadWriteQuiltV2-sales-prod'],
            })

            if (!Array.isArray(buckets)) {
              throw new Error('Bucket discovery service did not return an array')
            }

            if (buckets.length === 0) {
              throw new Error('No buckets discovered by BucketDiscoveryService')
            }

            return {
              bucketCount: buckets.length,
              hasValidBuckets: buckets.length > 0,
              serviceWorking: true,
            }
          },
        },
        {
          name: 'Enhanced Token Generator',
          fn: async () => {
            const tokenGenerator = new EnhancedTokenGenerator()
            const originalToken = (await authManager?.getCurrentToken()) || ''

            if (!originalToken) {
              throw new Error('No original token available for enhancement')
            }

            const enhancedToken = await tokenGenerator.generateEnhancedToken({
              originalToken,
              roles: ['ReadWriteQuiltV2-sales-prod'],
              buckets: (await authManager?.getCurrentBuckets()) || [],
            })

            if (!enhancedToken) {
              throw new Error('Enhanced token generation failed')
            }

            if (enhancedToken === originalToken) {
              throw new Error('Enhanced token is identical to original token')
            }

            return {
              hasEnhancedToken: !!enhancedToken,
              isDifferentFromOriginal: enhancedToken !== originalToken,
              tokenLength: enhancedToken.length,
            }
          },
        },
      ])

      // Test Suite 5: End-to-End Validation
      await runTestSuite('End-to-End Validation', [
        {
          name: 'Complete Auth Flow',
          fn: async () => {
            if (!authManager) throw new Error('AuthManager not available')

            // Test complete flow
            const token = await authManager.getCurrentToken()
            const buckets = await authManager.getCurrentBuckets()
            const authStatus = await mcpClient.getAuthenticationStatus()
            const headers = await mcpClient.getHeaders()

            if (
              !token ||
              !buckets ||
              !authStatus.hasBearerToken ||
              !headers.Authorization
            ) {
              throw new Error('Complete auth flow failed')
            }

            return {
              tokenRetrieved: !!token,
              bucketsDiscovered: buckets.length > 0,
              mcpAuthenticated: authStatus.hasBearerToken,
              headersGenerated: !!headers.Authorization,
              completeFlowWorking: true,
            }
          },
        },
        {
          name: 'Permission Validation',
          fn: async () => {
            const buckets = (await authManager?.getCurrentBuckets()) || []
            const sandboxBucket = buckets.find(
              (b: any) => b.name === 'quilt-sandbox-bucket',
            )

            if (!sandboxBucket) {
              throw new Error('quilt-sandbox-bucket not found in discovered buckets')
            }

            if (!sandboxBucket.permissions) {
              throw new Error('Sandbox bucket has no permissions')
            }

            const hasWritePermission = sandboxBucket.permissions.write
            const hasReadPermission = sandboxBucket.permissions.read

            if (!hasReadPermission) {
              throw new Error('Sandbox bucket missing read permission')
            }

            return {
              sandboxBucketFound: !!sandboxBucket,
              hasWritePermission,
              hasReadPermission,
              permissionsValid: hasReadPermission,
            }
          },
        },
      ])
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusColor = (testStatus: string) => {
    switch (testStatus) {
      case 'passed':
        return 'success'
      case 'failed':
        return 'error'
      case 'running':
        return 'primary'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (testStatus: string) => {
    switch (testStatus) {
      case 'passed':
        return '✅'
      case 'failed':
        return '❌'
      case 'running':
        return '🔄'
      default:
        return '⏳'
    }
  }

  const totalTests = testSuites.reduce(
    (sum, testSuite) => sum + testSuite.tests.length,
    0,
  )
  const passedTests = testSuites.reduce(
    (sum, testSuite) => sum + testSuite.tests.filter((t) => t.status === 'passed').length,
    0,
  )
  const failedTests = testSuites.reduce(
    (sum, testSuite) => sum + testSuite.tests.filter((t) => t.status === 'failed').length,
    0,
  )

  return (
    <M.Paper style={{ padding: '16px', margin: '16px 0' }}>
      <M.Typography variant="h5" gutterBottom>
        Dynamic Authentication Integration Test Suite
      </M.Typography>

      <M.Typography variant="body2" color="textSecondary" gutterBottom>
        Comprehensive testing of the dynamic auth flow including DynamicAuthManager,
        BucketDiscoveryService, Enhanced JWT generation, and MCP client integration.
      </M.Typography>

      {error && (
        <Alert severity="error" style={{ marginBottom: '16px' }}>
          MCP Context Error:{' '}
          {typeof error === 'string' ? error : (error as Error).message}
        </Alert>
      )}

      <M.Box display="flex" marginBottom={2}>
        <M.Button
          variant="contained"
          color="primary"
          onClick={runAllTests}
          disabled={isRunning || status !== 'ready'}
          startIcon={isRunning ? <M.CircularProgress size={20} /> : null}
        >
          {isRunning ? 'Running Tests...' : 'Run Integration Tests'}
        </M.Button>

        {totalTests > 0 && (
          <M.Chip
            label={`${passedTests}/${totalTests} tests passed`}
            color={failedTests === 0 ? 'primary' : 'secondary'}
            variant="outlined"
          />
        )}
      </M.Box>

      {currentTest && (
        <Alert severity="info" style={{ marginBottom: '16px' }}>
          Currently running: {currentTest}
        </Alert>
      )}

      {testSuites.map((testSuite, suiteIndex) => (
        <M.ExpansionPanel key={suiteIndex} style={{ marginBottom: '8px' }}>
          <M.ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
            <M.Box display="flex" alignItems="center">
              <span>{getStatusIcon(testSuite.overallStatus)}</span>
              <M.Typography variant="h6">{testSuite.name}</M.Typography>
              <M.Chip
                label={testSuite.overallStatus}
                color={getStatusColor(testSuite.overallStatus) as any}
                size="small"
              />
              {testSuite.endTime && testSuite.startTime && (
                <M.Typography variant="caption" color="textSecondary">
                  ({testSuite.endTime - testSuite.startTime}ms)
                </M.Typography>
              )}
            </M.Box>
          </M.ExpansionPanelSummary>
          <M.ExpansionPanelDetails>
            <M.List dense>
              {testSuite.tests.map((test, testIndex) => (
                <M.ListItem key={testIndex}>
                  <M.ListItemIcon>
                    <span>{getStatusIcon(test.status)}</span>
                  </M.ListItemIcon>
                  <M.ListItemText
                    primary={test.name}
                    secondary={
                      <M.Box>
                        <M.Typography variant="body2" color="textSecondary">
                          {test.message}
                        </M.Typography>
                        {test.duration && (
                          <M.Typography variant="caption" color="textSecondary">
                            Duration: {test.duration}ms
                          </M.Typography>
                        )}
                        {test.details && (
                          <M.Collapse in={false}>
                            <M.Typography variant="caption" component="pre">
                              {JSON.stringify(test.details, null, 2)}
                            </M.Typography>
                          </M.Collapse>
                        )}
                      </M.Box>
                    }
                  />
                </M.ListItem>
              ))}
            </M.List>
          </M.ExpansionPanelDetails>
        </M.ExpansionPanel>
      ))}

      {testSuites.length === 0 && !isRunning && (
        <M.Typography variant="body2" color="textSecondary" align="center">
          Click "Run Integration Tests" to start comprehensive testing
        </M.Typography>
      )}
    </M.Paper>
  )
}
