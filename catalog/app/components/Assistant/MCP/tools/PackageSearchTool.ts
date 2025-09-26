/**
 * MCP Tool for searching Quilt packages
 */

import * as Eff from 'effect'
import { MCPClient, QuiltPackageSearchArgs } from '../types'

export interface PackageSearchToolProps {
  onSearchComplete?: (results: any[]) => void
  onError?: (error: Error) => void
}

export const usePackageSearch = (mcpClient: MCPClient) => {
  const searchPackages = async (args: QuiltPackageSearchArgs) => {
    try {
      const tools = await mcpClient.listAvailableTools()
      const searchTool = tools.find((tool: any) => tool.name === 'quilt_package_search')

      if (!searchTool) {
        throw new Error('Package search tool not available')
      }

      const result = await mcpClient.callTool({
        name: 'quilt_package_search',
        arguments: args,
      })

      return result
    } catch (error) {
      console.error('Package search error:', error)
      throw error
    }
  }

  return { searchPackages }
}
