/**
 * MCP Module - Ultra Simple Version
 */

// Core MCP functionality
export { mcpClient, QuiltMCPClient } from './Client'

// Test Component
export { default as MCPTestComponent } from './MCPTestComponent'

// Context integration
export {
  MCPContextProvider,
  useMCPStatus,
  useMCPContextStateValue,
} from './MCPContextProvider'

export { OAuthLoginButton } from './OAuthLoginButton'
export { OAuthCallback } from './OAuthCallback'
