/**
 * Generic Tool Executor for MCP Tools
 *
 * This file provides a generic interface for executing any MCP tool
 * dynamically loaded from the server.
 */

import type { MCPClient, MCPTool, MCPToolCall, MCPToolResult } from '../types'

export interface GenericToolExecutorProps {
  onExecutionComplete?: (result: MCPToolResult) => void
  onError?: (error: Error) => void
}

export interface ToolExecutionResult {
  success: boolean
  result?: MCPToolResult
  error?: string
}

export const useGenericToolExecutor = (mcpClient: MCPClient) => {
  /**
   * Execute any MCP tool with the given arguments
   */
  const executeTool = async (
    toolName: string,
    toolArgs: Record<string, any>,
  ): Promise<ToolExecutionResult> => {
    try {
      // First, get available tools to validate the tool exists
      const availableTools = await mcpClient.listAvailableTools()
      const tool = availableTools.find((t) => t.name === toolName)

      if (!tool) {
        return {
          success: false,
          error: `Tool "${toolName}" not found. Available tools: ${availableTools.map((t) => t.name).join(', ')}`,
        }
      }

      // Execute the tool
      const result = await mcpClient.callTool({
        name: toolName,
        arguments: toolArgs,
      })

      return {
        success: true,
        result,
      }
    } catch (error) {
      console.error(`Tool execution error for ${toolName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get all available tools from the MCP server
   */
  const getAvailableTools = async (): Promise<MCPTool[]> => {
    try {
      return await mcpClient.listAvailableTools()
    } catch (error) {
      console.error('Failed to get available tools:', error)
      return []
    }
  }

  /**
   * Get a specific tool by name
   */
  const getTool = async (toolName: string): Promise<MCPTool | null> => {
    try {
      const tools = await mcpClient.listAvailableTools()
      return tools.find((t) => t.name === toolName) || null
    } catch (error) {
      console.error(`Failed to get tool ${toolName}:`, error)
      return null
    }
  }

  /**
   * Validate tool arguments against the tool's schema
   */
  const validateToolArguments = (
    tool: MCPTool,
    toolArgs: Record<string, any>,
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!tool.inputSchema || tool.inputSchema.type !== 'object') {
      return { valid: true, errors: [] } // Skip validation if no schema
    }

    const schema = tool.inputSchema
    const required = schema.required || []
    const properties = schema.properties || {}

    // Check required fields
    for (const field of required) {
      if (!(field in toolArgs)) {
        errors.push(`Required field "${field}" is missing`)
      }
    }

    // Check field types (basic validation)
    for (const [field, value] of Object.entries(toolArgs)) {
      if (field in properties) {
        const fieldSchema = properties[field]
        const expectedType = fieldSchema.type

        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Field "${field}" should be a string`)
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Field "${field}" should be a number`)
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Field "${field}" should be a boolean`)
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Field "${field}" should be an array`)
        } else if (
          expectedType === 'object' &&
          (typeof value !== 'object' || Array.isArray(value))
        ) {
          errors.push(`Field "${field}" should be an object`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  return {
    executeTool,
    getAvailableTools,
    getTool,
    validateToolArguments,
  }
}
