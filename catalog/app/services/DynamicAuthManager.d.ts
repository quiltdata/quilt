/**
 * TypeScript declarations for DynamicAuthManager
 */

export interface DynamicAuthManagerConfig {
  enableDynamicDiscovery: boolean
  enableTokenEnhancement: boolean
  cacheTimeout: number
  refreshThreshold: number
  maxRetries: number
  retryDelay: number
}

export interface RefreshResult {
  success: boolean
  buckets?: any[]
  token?: string
  bucketCount?: number
  error?: string
}

export class DynamicAuthManager {
  constructor(reduxStore: any)
  
  initialize(): Promise<boolean>
  getCurrentToken(): Promise<string | null>
  getCurrentBuckets(): Promise<any[]>
  getOriginalToken(): Promise<string | null>
  getUserRolesFromState(): string[]
  refreshToken(): Promise<void>
  shouldRefreshToken(): boolean
  getAuthStatus(): Promise<any>
  refreshAll(): Promise<RefreshResult>
  getDebugInfo(): any
  getTokenStats(token: string): any
  handleRoleChange(role: string): Promise<void>
  getConfig(): DynamicAuthManagerConfig
  updateConfig(config: Partial<DynamicAuthManagerConfig>): void
  clearCache(): void
}
