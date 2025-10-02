/**
 * Quilt Visualization MCP Server
 *
 * This server provides MCP tools for Quilt visualization creation
 */

const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(bodyParser.json())

// MCP Server implementation
class QuiltVisualizationMCPServer {
  constructor() {
    this.tools = [
      {
        id: 'quilt-visualization-create',
        name: 'Create Quilt Visualization',
        description: 'Generates a data visualization for Quilt data',
        input_schema: {
          type: 'object',
          properties: {
            data_source: { type: 'string', description: 'S3 URI or package reference' },
            chart_type: {
              type: 'string',
              enum: ['vega', 'echarts', 'perspective'],
              description: 'Type of chart to create',
            },
            spec: {
              type: 'object',
              description: 'Visualization specification (e.g., Vega-Lite)',
            },
          },
          required: ['data_source', 'chart_type', 'spec'],
        },
        output_schema: {
          type: 'object',
          properties: {
            visualization_id: { type: 'string' },
            url: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    ]
  }

  // List available tools
  listTools() {
    return this.tools
  }

  // Execute a tool
  async executeTool(toolId, args) {
    switch (toolId) {
      case 'quilt-visualization-create':
        return this.createVisualization(args)
      default:
        throw new Error(`Unknown tool: ${toolId}`)
    }
  }

  // Create visualization (mock implementation)
  async createVisualization(args) {
    const { data_source, chart_type, spec } = args

    // Mock visualization creation
    const visualizationId = `mock-viz-${Date.now()}`
    const mockUrl = `https://mock-quilt.com/viz/${chart_type}/${visualizationId}`

    return {
      visualization_id: visualizationId,
      url: mockUrl,
      message: `Mock ${chart_type} visualization created for data source: ${data_source}`,
    }
  }
}

const mcpServer = new QuiltVisualizationMCPServer()

// Routes
app.get('/tools', (req, res) => {
  res.json(mcpServer.listTools())
})

app.post('/execute', async (req, res) => {
  try {
    const { tool_id, args } = req.body
    const result = await mcpServer.executeTool(tool_id, args)
    res.json({ tool_id, result })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Quilt Visualization MCP Server running on port ${PORT}`)
})
