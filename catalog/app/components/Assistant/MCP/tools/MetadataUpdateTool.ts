/**
 * MCP Tool for updating Quilt package metadata
 */

import * as Eff from 'effect'
import { MCPClient, QuiltMetadataUpdateArgs } from '../types'

export interface MetadataUpdateToolProps {
  onUpdateComplete?: (result: any) => void
  onError?: (error: Error) => void
}

export const useMetadataUpdate = (mcpClient: MCPClient) => {
  const updateMetadata = async (args: QuiltMetadataUpdateArgs) => {
    try {
      const tools = await mcpClient.listAvailableTools()
      const updateTool = tools.find((tool: any) => tool.name === 'quilt_metadata_update')

      if (!updateTool) {
        throw new Error('Metadata update tool not available')
      }

      const result = await mcpClient.callTool({
        name: 'quilt_metadata_update',
        arguments: args,
      })

      return result
    } catch (error) {
      console.error('Metadata update error:', error)
      throw error
    }
  }

  return { updateMetadata }
}
