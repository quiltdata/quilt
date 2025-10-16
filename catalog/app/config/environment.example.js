/**
 * Environment Configuration Example
 *
 * Copy this file to environment.js and update the values for your environment.
 */

export const environmentConfig = {
  // GraphQL Configuration
  graphql: {
    endpoint: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
    wsEndpoint:
      process.env.REACT_APP_GRAPHQL_WS_ENDPOINT || 'ws://localhost:3000/graphql',
  },

  // MCP Server Configuration
  mcp: {
    serverUrl: process.env.REACT_APP_MCP_SERVER_URL || 'http://localhost:8000/mcp',
    wsUrl: process.env.REACT_APP_MCP_SERVER_WS_URL || 'ws://localhost:8000/mcp',
    serverUrlProd:
      process.env.REACT_APP_MCP_SERVER_URL_PROD || 'https://demo.quiltdata.com/mcp',
    wsUrlProd:
      process.env.REACT_APP_MCP_SERVER_WS_URL_PROD || 'wss://demo.quiltdata.com/mcp',
  },

  // Authentication Configuration
  auth: {
    enableDynamicDiscovery:
      process.env.REACT_APP_AUTH_ENABLE_DYNAMIC_DISCOVERY === 'true',
    enableTokenEnhancement:
      process.env.REACT_APP_AUTH_ENABLE_TOKEN_ENHANCEMENT === 'true',
    cacheTimeout: parseInt(process.env.REACT_APP_AUTH_CACHE_TIMEOUT || '300000'),
    refreshThreshold: parseInt(process.env.REACT_APP_AUTH_REFRESH_THRESHOLD || '60000'),
  },

  // Bucket Discovery Configuration
  bucketDiscovery: {
    enabled: process.env.REACT_APP_BUCKET_DISCOVERY_ENABLED === 'true',
    cacheTimeout: parseInt(
      process.env.REACT_APP_BUCKET_DISCOVERY_CACHE_TIMEOUT || '300000',
    ),
    maxRetries: parseInt(process.env.REACT_APP_BUCKET_DISCOVERY_MAX_RETRIES || '3'),
  },

  // Debug Configuration
  debug: {
    auth: process.env.REACT_APP_DEBUG_AUTH === 'true',
    mcp: process.env.REACT_APP_DEBUG_MCP === 'true',
    bucketDiscovery: process.env.REACT_APP_DEBUG_BUCKET_DISCOVERY === 'true',
  },

  // AWS Configuration
  aws: {
    accountId: process.env.REACT_APP_AWS_ACCOUNT_ID || '850787717197',
    region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  },

  // Default Buckets
  defaultBuckets: (
    process.env.REACT_APP_DEFAULT_BUCKETS || 'quilt-sandbox-bucket,nf-core-gallery'
  ).split(','),

  // Token Configuration
  token: {
    version: process.env.REACT_APP_TOKEN_ENHANCEMENT_VERSION || '2.0',
    audience: process.env.REACT_APP_TOKEN_AUDIENCE || 'quilt-mcp-server',
    issuer: process.env.REACT_APP_TOKEN_ISSUER || 'quilt-frontend-enhanced',
  },

  // Security Configuration
  security: {
    enableTokenValidation: process.env.REACT_APP_ENABLE_TOKEN_VALIDATION === 'true',
    enablePermissionValidation:
      process.env.REACT_APP_ENABLE_PERMISSION_VALIDATION === 'true',
    enableBucketValidation: process.env.REACT_APP_ENABLE_BUCKET_VALIDATION === 'true',
  },

  // Performance Configuration
  performance: {
    enableCaching: process.env.REACT_APP_ENABLE_CACHING === 'true',
    cacheCleanupInterval: parseInt(
      process.env.REACT_APP_CACHE_CLEANUP_INTERVAL || '300000',
    ),
    maxCacheSize: parseInt(process.env.REACT_APP_MAX_CACHE_SIZE || '100'),
  },

  // Monitoring Configuration
  monitoring: {
    enableMetrics: process.env.REACT_APP_ENABLE_METRICS === 'true',
    metricsEndpoint: process.env.REACT_APP_METRICS_ENDPOINT || '/api/metrics',
    logLevel: process.env.REACT_APP_LOG_LEVEL || 'info',
  },

  // Feature Flags
  features: {
    dynamicBuckets: process.env.REACT_APP_FEATURE_DYNAMIC_BUCKETS === 'true',
    enhancedTokens: process.env.REACT_APP_FEATURE_ENHANCED_TOKENS === 'true',
    roleMapping: process.env.REACT_APP_FEATURE_ROLE_MAPPING === 'true',
    authManager: process.env.REACT_APP_FEATURE_AUTH_MANAGER === 'true',
  },
}

export default environmentConfig
