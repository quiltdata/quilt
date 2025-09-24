/**
 * MCP (Model Context Protocol) Types and Interfaces
 *
 * This file defines the core types and interfaces for the MCP Client
 * that will be used to integrate with Docker-based MCP servers.
 */

// Core MCP Types
export interface MCPServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface MCPServerConnection {
  server: MCPServerConfig
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
    title?: string
    description?: string
    $schema?: string
  }
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, any>
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image_url' | 'resource'
    text?: string
    image_url?: { url: string }
    resource?: { uri: string; mimeType?: string }
  }>
  isError?: boolean
}

// Quilt-specific MCP Tool Arguments
export interface QuiltPackageSearchArgs {
  query: string
  limit?: number
  bucket?: string
}

export interface QuiltPackageCreationArgs {
  name: string
  description?: string
  files: string[]
  metadata?: Record<string, any>
  bucket?: string
}

export interface QuiltMetadataUpdateArgs {
  packageName: string
  metadata: Record<string, any>
  bucket?: string
}

export interface QuiltVisualizationArgs {
  data: any
  type: 'vega' | 'vega-lite' | 'echarts' | 'perspective'
  config?: Record<string, any>
}

// OAuth 2.1 Types
export interface OAuthDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  revocation_endpoint?: string
  introspection_endpoint?: string
  device_authorization_endpoint?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  grant_types_supported?: string[]
  code_challenge_methods_supported?: string[]
}

export interface OAuthToken {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope?: string
  expires_at?: number // Computed from expires_in
}

export interface OAuthAuthState {
  codeVerifier: string
  state: string
  redirectUri: string
}

// MCP Client Interface
export interface MCPClient {
  initialize(): Promise<void>
  connectToServer(config?: MCPServerConfig): Promise<void>
  disconnectFromServer(serverName?: string): void
  listAvailableTools(): Promise<MCPTool[]>
  callTool(toolCall: MCPToolCall): Promise<MCPToolResult>
  getServerStatus(): MCPServerConnection['status']
  hasSession(): boolean

  // OAuth methods
  discoverOAuth(): Promise<OAuthDiscovery | null>
  startOAuthFlow(): Promise<string> // Returns authorization URL
  handleOAuthCallback(code: string, state: string): Promise<OAuthToken>
  refreshToken(): Promise<OAuthToken>
  getAccessToken(): Promise<string | null>
  isAuthenticated(): boolean
  logout(): void
}

// MCP Tool Hooks Return Types
export interface UsePackageSearchReturn {
  searchPackages: (args: QuiltPackageSearchArgs) => Promise<any[]>
  isLoading: boolean
  error: string | null
}

export interface UsePackageCreationReturn {
  createPackage: (args: QuiltPackageCreationArgs) => Promise<any>
  isLoading: boolean
  error: string | null
}

export interface UseMetadataUpdateReturn {
  updateMetadata: (args: QuiltMetadataUpdateArgs) => Promise<any>
  isLoading: boolean
  error: string | null
}

export interface UseVisualizationReturn {
  createVisualization: (args: QuiltVisualizationArgs) => Promise<any>
  isLoading: boolean
  error: string | null
}
