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

  setTokenGetter(getter: (() => Promise<string | null>) | null): void

  initialize(): Promise<boolean>
  getCurrentToken(): Promise<string | null>
  getCurrentBuckets(): Promise<any[]>
  getOriginalToken(): Promise<string | null>
  getUserRolesFromState(): string[]
  getAuthStatus(): Promise<any>
  refreshAll(): Promise<RefreshResult>
  getDebugInfo(): any
}

export function findTokenInState(state: any): TokenLookupResult
export function findRolesInState(state: any): string[]
