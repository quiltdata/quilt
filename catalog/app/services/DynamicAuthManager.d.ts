/**
 * TypeScript declarations for DynamicAuthManager
 */

export interface DynamicAuthManagerConfig {
  enableDynamicDiscovery: boolean
  enableTokenEnhancement: boolean
  cacheTimeout: number
  refreshThreshold: number
}

export interface RefreshResult {
  success: boolean
  buckets?: any[]
  token?: string | null
  bucketCount?: number
  error?: string
}

export interface TokenLookupResult {
  token: string | null
  source: string | null
}

export class DynamicAuthManager {
  constructor(reduxStore: any, tokenGetter?: (() => Promise<string | null>) | null)

  reduxStore: any

  tokenGetter: (() => Promise<string | null>) | null

  currentRole: any

  availableRoles: any[]

  setTokenGetter(getter: (() => Promise<string | null>) | null): void

  setRoleInfo(roleInfo: any): void

  initialize(): Promise<boolean>

  getCurrentToken(): Promise<string | null>

  getCurrentBuckets(): Promise<any[]>

  getOriginalToken(): Promise<string | null>

  getUserRolesFromState(): string[]

  getAuthStatus(): Promise<any>
  refreshAll(): Promise<RefreshResult>
  getDebugInfo(): any

  // Additional methods required by AuthTest.tsx
  getTokenStats(): Promise<any>
  refreshToken(): Promise<string | null>
  handleRoleChange(newRoleName: string): Promise<any>
  getConfig(): DynamicAuthManagerConfig
  updateConfig(newConfig: Partial<DynamicAuthManagerConfig>): void
  clearCache(): void
}

export function findTokenInState(state: any): TokenLookupResult
export function findRolesInState(state: any): string[]
