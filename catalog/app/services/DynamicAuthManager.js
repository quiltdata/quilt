/**
 * DynamicAuthManager
 *
 * Centralized manager for handling dynamic authentication, token generation,
 * and bucket discovery. Provides a unified interface for all authentication operations.
 */

import { BucketDiscoveryService } from './BucketDiscoveryService'
import { EnhancedTokenGenerator } from './EnhancedTokenGenerator'

class DynamicAuthManager {
  constructor(reduxStore, tokenGetter = null) {
    this.reduxStore = reduxStore
    this.tokenGetter = tokenGetter

    // Initialize services
    this.bucketDiscovery = new BucketDiscoveryService()
    this.tokenGenerator = new EnhancedTokenGenerator()

    // State management
    this.currentBuckets = []
    this.currentToken = null
    this.isInitialized = false

    // Configuration
    this.config = {
      enableDynamicDiscovery: true,
      enableTokenEnhancement: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      refreshThreshold: 60 * 1000, // 1 minute before expiry
    }
  }

  /**
   * Initialize the dynamic auth manager
   * @returns {Promise<boolean>} Initialization success
   */
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

  /**
   * Get current enhanced token
   * @returns {Promise<string|null>} Current enhanced token
   */
  async getCurrentToken() {
    try {
      if (!this.isInitialized) await this.initialize()

      const originalToken = await this.getOriginalToken()
      if (!originalToken) {
        console.warn('⚠️ No original token found')
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

  /**
   * Get current accessible buckets
   * @returns {Promise<Array>} Current accessible buckets
   */
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

  /**
   * Get original token from Redux store
   * @returns {Promise<string|null>} Original token
   */
  async getOriginalToken() {
    try {
      // First try the token getter if available (preferred method)
      if (this.tokenGetter) {
        console.log('🔍 DynamicAuthManager: Using token getter...')
        const token = await this.tokenGetter()
        if (token) {
          console.log('✅ DynamicAuthManager: Token retrieved via getter')
          return token
        }
      }

      // Fallback: try to get token from Redux state directly
      console.log('🔍 DynamicAuthManager: Falling back to Redux state access...')
      const state = this.reduxStore.getState()

      // Try to get token from auth state
      if (state.auth && state.auth.tokens && state.auth.tokens.token) {
        console.log('✅ DynamicAuthManager: Token found in Redux auth state')
        return state.auth.tokens.token
      }

      // Fallback: try other possible locations
      if (state.user && state.user.token) {
        console.log('✅ DynamicAuthManager: Token found in Redux user state')
        return state.user.token
      }

      console.warn('⚠️ No token found in Redux state')
      return null
    } catch (error) {
      console.error('❌ Error getting original token:', error)
      return null
    }
  }

  /**
   * Get user roles from Redux state
   * @returns {Array} User roles
   */
  getUserRolesFromState() {
    try {
      const state = this.reduxStore.getState()

      if (state.auth && state.auth.user && state.auth.user.roles) {
        return state.auth.user.roles.map((role) => role.name)
      }

      if (state.user && state.user.roles) {
        return state.user.roles.map((role) => role.name)
      }

      console.warn('⚠️ Could not extract roles from state')
      return []
    } catch (error) {
      console.error('❌ Error extracting roles from state:', error)
      return []
    }
  }

  /**
   * Get authentication status
   * @returns {Promise<Object>} Authentication status
   */
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

  /**
   * Force refresh of buckets and token
   * @returns {Promise<Object>} Refresh result
   */
  async refreshAll() {
    try {
      console.log('🔄 DynamicAuthManager: Force refreshing all data...')

      // Refresh buckets
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

  /**
   * Get debug information
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      currentBuckets: this.currentBuckets.length,
      config: this.config,
      bucketCacheStats: this.bucketDiscovery.getCacheStats(),
    }
  }
}

export { DynamicAuthManager }
