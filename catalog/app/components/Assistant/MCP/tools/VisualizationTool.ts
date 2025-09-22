/**
 * MCP Tool for creating Quilt visualizations
 */

import * as Eff from 'effect'
import { MCPClient, QuiltVisualizationArgs } from '../types'

export interface VisualizationToolProps {
  onVisualizationCreated?: (result: any) => void
  onError?: (error: Error) => void
}

export const useVisualization = (mcpClient: MCPClient) => {
  const createVisualization = async (args: QuiltVisualizationArgs) => {
    try {
      const tools = await mcpClient.listAvailableTools()
      const vizTool = tools.find(
        (tool: any) => tool.name === 'quilt_visualization_create',
      )

      if (!vizTool) {
        throw new Error('Visualization tool not available')
      }

      const result = await mcpClient.callTool({
        name: 'quilt_visualization_create',
        arguments: args,
      })

      return result
    } catch (error) {
      console.error('Visualization creation error:', error)
      throw error
    }
  }

  return { createVisualization }
}
