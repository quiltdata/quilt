/**
 * DynamicAuthManager
 *
 * Centralized manager for handling dynamic authentication, token generation,
 * and bucket discovery. Provides a unified interface for all authentication operations.
 */

import * as authSelectors from 'containers/Auth/selectors'
import { REDUX_KEY as AUTH_REDUX_KEY } from 'containers/Auth/constants'

import { BucketDiscoveryService } from './BucketDiscoveryService'
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
    console.log(`🔍 findRolesInState: Normalized single role at index ${index}:`, normalized)
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
    this.tokenGenerator = new EnhancedTokenGenerator()

    this.currentBuckets = []
    this.currentToken = null
    this.isInitialized = false

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

      const freshBuckets = await this.bucketDiscovery.getAccessibleBuckets({
        token: originalToken,
        roles: userRoles,
      })
      this.currentBuckets = freshBuckets

      console.log('🔍 DynamicAuthManager: Retrieved', freshBuckets.length, 'buckets')
      return freshBuckets
    } catch (error) {
      console.error('❌ Error getting current buckets:', error)
      return []
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

  getUserRolesFromState() {
    try {
      const state = this.reduxStore.getState()
      console.log('🔍 DynamicAuthManager: Redux state for role extraction:', state)
      
      const roles = findRolesInState(state)
      console.log('🔍 DynamicAuthManager: Extracted roles:', roles)
      
      if (!roles.length) {
        console.warn('⚠️ DynamicAuthManager: Could not extract roles from state')
        // Debug: Check what's in the auth domain
        try {
          const domain = authSelectors.domain(state)
          console.log('🔍 DynamicAuthManager: Auth domain:', domain)
          if (domain?.user) {
            console.log('🔍 DynamicAuthManager: User object:', domain.user)
            console.log('🔍 DynamicAuthManager: User roles:', domain.user.roles)
            console.log('🔍 DynamicAuthManager: User role:', domain.user.role)
          }
        } catch (debugError) {
          console.log('🔍 DynamicAuthManager: Debug error:', debugError)
        }
      }
      return roles
    } catch (error) {
      console.error('❌ Error extracting roles from state:', error)
      return []
    }
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
}

export { DynamicAuthManager, findTokenInState, findRolesInState }
