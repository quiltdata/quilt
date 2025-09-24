/* eslint-disable no-console */
/**
 * DynamicAuthManager
 *
 * Centralized manager for handling dynamic authentication, token generation,
 * and bucket discovery. Provides a unified interface for all authentication operations.
 */

import * as authSelectors from 'containers/Auth/selectors'
import { REDUX_KEY as AUTH_REDUX_KEY } from 'containers/Auth/constants'

import { BucketDiscoveryService } from './BucketDiscoveryService'
import { AWSBucketDiscoveryService } from './AWSBucketDiscoveryService'
import { EnhancedTokenGenerator } from './EnhancedTokenGenerator'

const unwrapImmutable = (value) =>
  value && typeof value.toJS === 'function' ? value.toJS() : value

const getFromState = (state, path) => {
  if (!state) return undefined
  if (typeof state.getIn === 'function') {
    return unwrapImmutable(state.getIn(path))
  }
  let current = state
  for (const key of path) {
    if (current == null) return undefined
    current = current[key]
  }
  return unwrapImmutable(current)
}

const TOKEN_CANDIDATE_KEYS = [
  'token',
  'accessToken',
  'access_token',
  'bearerToken',
  'jwt',
]

const pickTokenString = (candidate) => {
  if (!candidate) return null
  if (typeof candidate === 'string') return candidate
  if (typeof candidate === 'object') {
    for (const key of TOKEN_CANDIDATE_KEYS) {
      const value = candidate[key]
      if (typeof value === 'string' && value.trim()) return value
    }
  }
  return null
}

export const findTokenInState = (state) => {
  try {
    const tokensFromSelector = authSelectors.tokens(state)
    const token = pickTokenString(tokensFromSelector)
    if (token) {
      return { token, source: `${AUTH_REDUX_KEY}::tokens` }
    }
  } catch (error) {
    console.warn('⚠️ DynamicAuthManager: authSelectors.tokens failed', error)
  }

  const fallbackTokens = getFromState(state, [AUTH_REDUX_KEY, 'tokens'])
  const fallbackToken = pickTokenString(fallbackTokens)
  if (fallbackToken) {
    return { token: fallbackToken, source: `${AUTH_REDUX_KEY}::tokens` }
  }

  const fallbackPaths = [
    { path: [AUTH_REDUX_KEY, 'token'], source: `${AUTH_REDUX_KEY}::token` },
    { path: [AUTH_REDUX_KEY, 'accessToken'], source: `${AUTH_REDUX_KEY}::accessToken` },
    { path: [AUTH_REDUX_KEY, 'access_token'], source: `${AUTH_REDUX_KEY}::access_token` },
    { path: ['user', 'token'], source: 'user::token' },
  ]

  for (const { path, source } of fallbackPaths) {
    const value = getFromState(state, path)
    const token = pickTokenString(value)
    if (token) {
      return { token, source }
    }
  }

  return { token: null, source: null }
}

const normalizeRoleValue = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name
    if (typeof value.title === 'string') return value.title
  }
  return null
}

const extractBucketNames = (buckets) => {
  if (!Array.isArray(buckets)) return []
  return buckets
    .map((bucket) => {
      if (typeof bucket === 'string') return bucket.trim()
      if (bucket && typeof bucket.name === 'string') return bucket.name.trim()
      return null
    })
    .filter((name) => typeof name === 'string' && name.length > 0)
}

export const findRolesInState = (state) => {
  const roles = new Set()
  console.log('🔍 findRolesInState: Starting role extraction from state:', state)

  try {
    const domain = authSelectors.domain(state)
    console.log('🔍 findRolesInState: Auth domain:', domain)

    if (domain?.user) {
      const { user } = domain
      console.log('🔍 findRolesInState: User object:', user)
      console.log('🔍 findRolesInState: User object keys:', Object.keys(user))
      console.log('🔍 findRolesInState: User roles array:', user.roles)
      console.log('🔍 findRolesInState: User current role:', user.role)
      console.log('🔍 findRolesInState: User role_id:', user.role_id)

      if (Array.isArray(user.roles)) {
        user.roles.forEach((role) => {
          const normalized = normalizeRoleValue(role)
          console.log('🔍 findRolesInState: Normalized role from array:', normalized)
          if (normalized) roles.add(normalized)
        })
      }
      const currentRole = normalizeRoleValue(user.role)
      console.log('🔍 findRolesInState: Normalized current role:', currentRole)
      if (currentRole) roles.add(currentRole)
    }
  } catch (error) {
    console.warn('⚠️ DynamicAuthManager: authSelectors.domain failed', error)
  }

  const fallbackRoleLists = [
    getFromState(state, [AUTH_REDUX_KEY, 'user', 'roles']),
    getFromState(state, [AUTH_REDUX_KEY, 'roles']),
    getFromState(state, ['user', 'roles']),
  ]

  console.log('🔍 findRolesInState: Fallback role lists:', fallbackRoleLists)

  fallbackRoleLists.forEach((list, index) => {
    if (Array.isArray(list)) {
      console.log(`🔍 findRolesInState: Found role array at index ${index}:`, list)
      list.forEach((role) => {
        const normalized = normalizeRoleValue(role)
        console.log('🔍 findRolesInState: Normalized fallback role:', normalized)
        if (normalized) roles.add(normalized)
      })
    }
  })

  const singleRoleCandidates = [
    getFromState(state, [AUTH_REDUX_KEY, 'user', 'role']),
    getFromState(state, [AUTH_REDUX_KEY, 'role']),
    getFromState(state, ['user', 'role']),
  ]

  console.log('🔍 findRolesInState: Single role candidates:', singleRoleCandidates)

  singleRoleCandidates.forEach((candidate, index) => {
    const normalized = normalizeRoleValue(candidate)
    console.log(
      `🔍 findRolesInState: Normalized single role at index ${index}:`,
      normalized,
    )
    if (normalized) roles.add(normalized)
  })

  const finalRoles = Array.from(roles)
  console.log('🔍 findRolesInState: Final extracted roles:', finalRoles)
  return finalRoles
}

class DynamicAuthManager {
  constructor(reduxStore, tokenGetter = null) {
    this.reduxStore = reduxStore
    this.tokenGetter = tokenGetter

    this.bucketDiscovery = new BucketDiscoveryService()
    this.awsBucketDiscovery = new AWSBucketDiscoveryService()
    this.tokenGenerator = new EnhancedTokenGenerator()

    this.currentBuckets = []
    this.currentToken = null
    this.isInitialized = false

    // Role information will be set by MCPContextProvider
    this.currentRole = null
    this.availableRoles = []

    this.config = {
      enableDynamicDiscovery: true,
      enableTokenEnhancement: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      refreshThreshold: 60 * 1000, // 1 minute before expiry
    }
  }

  setTokenGetter(getter) {
    this.tokenGetter = getter
  }

  async initialize() {
    try {
      console.log('🚀 Initializing DynamicAuthManager...')
      this.isInitialized = true
      console.log('✅ DynamicAuthManager initialized successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize DynamicAuthManager:', error)
      return false
    }
  }

  async getCurrentToken() {
    try {
      if (!this.isInitialized) await this.initialize()

      const originalToken = await this.getOriginalToken()
      if (!originalToken) {
        console.warn('⚠️ DynamicAuthManager: No bearer token available')
        return null
      }

      const userRoles = this.getUserRolesFromState()

      // CRITICAL: Don't generate token if no roles are available
      if (userRoles.length === 0) {
        console.warn(
          '⚠️ DynamicAuthManager: No roles available, waiting for role information...',
        )
        // Return the original token without enhancement if no roles are available
        return originalToken
      }

      // If we have role information, always regenerate the token to ensure it's up to date
      const shouldRegenerate = this.currentRole || this.availableRoles.length > 0

      if (this.currentToken && !shouldRegenerate) {
        console.log('🔍 DynamicAuthManager: Using cached token (no role info)')
        return this.currentToken
      }

      console.log('🔄 DynamicAuthManager: Regenerating token with current role info')

      // Validate role selection before proceeding
      this.validateRoleSelection()

      const buckets = await this.bucketDiscovery.getAccessibleBuckets({
        token: originalToken,
        roles: userRoles,
      })
      this.currentBuckets = buckets

      const enhancedToken = await this.tokenGenerator.generateEnhancedToken({
        originalToken,
        roles: userRoles,
        buckets,
      })

      this.currentToken = enhancedToken
      return enhancedToken
    } catch (error) {
      console.error('❌ Error getting current token:', error)
      return null
    }
  }

  async getCurrentBuckets() {
    try {
      if (!this.isInitialized) await this.initialize()

      const originalToken = await this.getOriginalToken()
      if (!originalToken) return []

      const userRoles = this.getUserRolesFromState()

      // Use AWS-based bucket discovery for more accurate bucket mapping
      const freshBuckets = await this.awsBucketDiscovery.getAccessibleBuckets({
        token: originalToken,
        roles: userRoles,
      })
      const bucketNames = extractBucketNames(freshBuckets)
      this.currentBuckets = bucketNames

      console.log(
        '🔍 DynamicAuthManager: Retrieved',
        bucketNames.length,
        'bucket names via AWS discovery',
      )
      return bucketNames
    } catch (error) {
      console.error('❌ Error getting current buckets:', error)
      // Fallback to original bucket discovery
      try {
        const originalToken = await this.getOriginalToken()
        if (!originalToken) return []

        const userRoles = this.getUserRolesFromState()

        const fallbackBuckets = await this.bucketDiscovery.getAccessibleBuckets({
          token: originalToken,
          roles: userRoles,
        })
        const bucketNames = extractBucketNames(fallbackBuckets)
        this.currentBuckets = bucketNames

        console.log(
          '🔄 DynamicAuthManager: Using fallback bucket discovery, found',
          bucketNames.length,
          'bucket names',
        )
        return bucketNames
      } catch (fallbackError) {
        console.error('❌ Fallback bucket discovery also failed:', fallbackError)
        return []
      }
    }
  }

  async getOriginalToken() {
    try {
      if (this.tokenGetter) {
        console.log('🔍 DynamicAuthManager: Using token getter...')
        const token = await this.tokenGetter()
        if (token) {
          console.log('✅ DynamicAuthManager: Token retrieved via getter')
          return token
        }
      }

      console.log('🔍 DynamicAuthManager: Falling back to Redux state access...')
      const state = this.reduxStore.getState()
      const { token, source } = findTokenInState(state)
      if (token) {
        console.log(`✅ DynamicAuthManager: Token found in Redux state (${source})`)
        return token
      }

      console.warn('⚠️ DynamicAuthManager: No bearer token located in Redux state')
      return null
    } catch (error) {
      console.error('❌ Error getting original token:', error)
      return null
    }
  }

  /**
   * Set role information from MCPContextProvider
   * @param {Object} roleInfo - Role information from AuthState.match()
   */
  setRoleInfo(roleInfo) {
    this.currentRole = roleInfo.currentRole
    this.availableRoles = roleInfo.availableRoles || []
    console.log('🔍 DynamicAuthManager: Role info set:', {
      currentRole: this.currentRole,
      availableRoles: this.availableRoles,
    })

    // Clear cached token when role info changes to force regeneration
    this.currentToken = null
    console.log('🔄 DynamicAuthManager: Cleared cached token due to role info change')

    // If we now have roles available, trigger token regeneration
    if (this.currentRole || this.availableRoles.length > 0) {
      console.log(
        '🔄 DynamicAuthManager: Roles now available, token will be regenerated on next request',
      )
    }
  }

  /**
   * Get user roles from the set role information
   * @returns {Array} User roles
   */
  getUserRolesFromState() {
    // Use the role information set by MCPContextProvider
    const roles = []

    // PRIORITY: Use the current/active role if available
    if (this.currentRole && this.currentRole.name) {
      roles.push(this.currentRole.name)
      console.log('🔍 DynamicAuthManager: Using ACTIVE role:', this.currentRole.name)
      console.log('🔍 Role Name Debug:', {
        'Raw Role Name': this.currentRole.name,
        'Trimmed Role Name': this.currentRole.name?.trim(),
        'Role Name Length': this.currentRole.name?.length,
        'Is ReadWrite Role': this.currentRole.name?.includes('Write'),
        'Exact Match Check': this.currentRole.name === 'ReadWriteQuiltV2-sales-prod',
      })
    } else if (this.availableRoles && this.availableRoles.length > 0) {
      // FALLBACK: If no current role, use the first available role (but log a warning)
      const firstRole = this.availableRoles[0]
      if (firstRole && firstRole.name) {
        roles.push(firstRole.name)
        console.warn(
          '⚠️ DynamicAuthManager: No active role set, using first available role:',
          firstRole.name,
        )
      }
    }

    console.log('🔍 DynamicAuthManager: Using role info from MCPContextProvider:', {
      currentRole: this.currentRole,
      availableRoles: this.availableRoles,
      extractedRoles: roles,
      roleSelectionMethod: this.currentRole ? 'active-role' : 'first-available',
    })

    return roles
  }

  async getAuthStatus() {
    const token = await this.getCurrentToken()
    const buckets = await this.getCurrentBuckets()

    return {
      hasToken: !!token,
      hasBuckets: buckets.length > 0,
      bucketCount: buckets.length,
      isInitialized: this.isInitialized,
      tokenStats: token ? this.tokenGenerator.getTokenStats(token) : null,
    }
  }

  async refreshAll() {
    try {
      console.log('🔄 DynamicAuthManager: Force refreshing all data...')

      const originalToken = await this.getOriginalToken()
      if (!originalToken) {
        throw new Error('Missing original token while refreshing')
      }

      const userRoles = this.getUserRolesFromState()

      const freshBuckets = await this.bucketDiscovery.refreshBuckets({
        token: originalToken,
        roles: userRoles,
      })
      this.currentBuckets = freshBuckets

      const freshToken = await this.tokenGenerator.generateEnhancedToken({
        originalToken,
        roles: userRoles,
        buckets: freshBuckets,
      })
      this.currentToken = freshToken

      return {
        success: true,
        buckets: freshBuckets,
        token: freshToken,
        bucketCount: freshBuckets.length,
      }
    } catch (error) {
      console.error('❌ Error refreshing all data:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      currentBuckets: this.currentBuckets.length,
      config: this.config,
      bucketCacheStats: this.bucketDiscovery.getCacheStats(),
    }
  }

  /**
   * Validate role selection and provide debugging information
   * @returns {Object} Role validation results
   */
  validateRoleSelection() {
    const validation = {
      hasCurrentRole: !!this.currentRole,
      hasAvailableRoles: this.availableRoles && this.availableRoles.length > 0,
      currentRoleName: this.currentRole?.name || null,
      currentRoleArn: this.currentRole?.arn || null,
      availableRoleNames: this.availableRoles?.map((r) => r.name) || [],
      selectedRoles: this.getUserRolesFromState(),
      isWriteRole: false,
      isReadRole: false,
      validationPassed: false,
      issues: [],
    }

    // Check if current role is a write role
    if (validation.currentRoleName) {
      validation.isWriteRole =
        validation.currentRoleName.includes('Write') ||
        validation.currentRoleName.includes('write') ||
        validation.currentRoleName.includes('WRITE')
      validation.isReadRole =
        validation.currentRoleName.includes('Read') ||
        validation.currentRoleName.includes('read') ||
        validation.currentRoleName.includes('READ')
    }

    // Validate role selection
    if (!validation.hasCurrentRole) {
      validation.issues.push('No current role set - using first available role')
    } else if (validation.selectedRoles.length === 0) {
      validation.issues.push('No roles selected for token generation')
    } else if (validation.selectedRoles.length > 1) {
      validation.issues.push('Multiple roles selected - should only use active role')
    } else {
      validation.validationPassed = true
    }

    // Log validation results
    console.log('🔍 Role Selection Validation:', validation)

    // Detailed validation debugging
    console.log('🔍 Detailed Role Validation:', {
      'Current Role Name': validation.currentRoleName,
      'Current Role ARN': validation.currentRoleArn,
      'Is Write Role': validation.isWriteRole,
      'Is Read Role': validation.isReadRole,
      'Selected Roles': validation.selectedRoles,
      'Available Role Names': validation.availableRoleNames,
      'Validation Passed': validation.validationPassed,
      Issues: validation.issues,
    })

    if (validation.issues.length > 0) {
      console.warn('⚠️ Role Selection Issues:', validation.issues)
    } else {
      console.log('✅ Role Selection Validation Passed')
    }

    return validation
  }

  // Additional methods required by AuthTest.tsx
  async getTokenStats() {
    try {
      const token = await this.getCurrentToken()
      if (!token) {
        return null
      }
      return this.tokenGenerator.getTokenStats(token)
    } catch (error) {
      console.error('❌ Error getting token stats:', error)
      return null
    }
  }

  async refreshToken() {
    try {
      console.log('🔄 DynamicAuthManager: Refreshing token...')
      this.currentToken = null // Clear cached token
      const newToken = await this.getCurrentToken()
      console.log('✅ DynamicAuthManager: Token refreshed successfully')
      return newToken
    } catch (error) {
      console.error('❌ Error refreshing token:', error)
      throw error
    }
  }

  async handleRoleChange(newRoleName) {
    try {
      console.log('🔄 DynamicAuthManager: Handling role change to:', newRoleName)

      // Find the role in available roles
      const newRole = this.availableRoles.find((role) => role.name === newRoleName)
      if (!newRole) {
        throw new Error(`Role ${newRoleName} not found in available roles`)
      }

      // Update current role
      this.currentRole = newRole

      // Clear cached token to force regeneration with new role
      this.currentToken = null

      // Regenerate token with new role
      const newToken = await this.getCurrentToken()

      console.log('✅ DynamicAuthManager: Role change handled successfully')
      return {
        success: true,
        newRole: this.currentRole,
        token: newToken,
      }
    } catch (error) {
      console.error('❌ Error handling role change:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  getConfig() {
    return { ...this.config }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    console.log('🔧 DynamicAuthManager: Config updated:', this.config)
  }

  clearCache() {
    console.log('🧹 DynamicAuthManager: Clearing all caches...')
    this.currentToken = null
    this.currentBuckets = []

    // Clear bucket discovery cache if it has a clearCache method
    if (this.bucketDiscovery && typeof this.bucketDiscovery.clearCache === 'function') {
      this.bucketDiscovery.clearCache()
    }

    console.log('✅ DynamicAuthManager: All caches cleared')
  }
}

export { DynamicAuthManager, findTokenInState, findRolesInState }
