/**
 * MCP Tool for creating Quilt packages
 */

import * as Eff from 'effect'
import { MCPClient, QuiltPackageCreationArgs } from '../types'

export interface PackageCreationToolProps {
  onCreationComplete?: (result: any) => void
  onError?: (error: Error) => void
}

export const usePackageCreation = (mcpClient: MCPClient) => {
  const createPackage = async (args: QuiltPackageCreationArgs) => {
    try {
      const tools = await mcpClient.listAvailableTools()
      const createTool = tools.find((tool: any) => tool.name === 'quilt_package_create')

      if (!createTool) {
        throw new Error('Package creation tool not available')
      }

      const result = await mcpClient.callTool({
        name: 'quilt_package_create',
        arguments: args,
      })

      return result
    } catch (error) {
      console.error('Package creation error:', error)
      throw error
    }
  }

  return { createPackage }
}
