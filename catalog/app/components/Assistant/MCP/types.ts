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

// MCP Client Interface
export interface MCPClient {
  initialize(): Promise<void>
  connectToServer(config?: MCPServerConfig): Promise<void>
  disconnectFromServer(serverName?: string): void
  listAvailableTools(): Promise<MCPTool[]>
  callTool(toolCall: MCPToolCall): Promise<MCPToolResult>
  getServerStatus(): MCPServerConnection['status']
  hasSession(): boolean
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
