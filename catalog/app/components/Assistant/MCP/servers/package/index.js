/**
 * Quilt Package MCP Server
 *
 * This server provides MCP tools for Quilt package management
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
class QuiltPackageMCPServer {
  constructor() {
    this.tools = [
      {
        id: 'quilt-package-search',
        name: 'Search Quilt Packages',
        description: 'Searches for packages within the Quilt data registry',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query string' },
            max_results: { type: 'number', description: 'Maximum number of results' },
          },
          required: ['query'],
        },
        output_schema: {
          type: 'object',
          properties: {
            packages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  hash: { type: 'string' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
      },
      {
        id: 'quilt-package-create',
        name: 'Create Quilt Package',
        description: 'Creates a new package in the Quilt data registry',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the new package' },
            description: { type: 'string', description: 'Description of the package' },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
            meta: { type: 'object', description: 'Metadata for the package' },
          },
          required: ['name', 'files'],
        },
        output_schema: {
          type: 'object',
          properties: {
            package_name: { type: 'string' },
            package_hash: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
      {
        id: 'quilt-metadata-update',
        name: 'Update Quilt Package Metadata',
        description: 'Updates metadata for an existing Quilt package',
        input_schema: {
          type: 'object',
          properties: {
            package_name: { type: 'string', description: 'Name of the package' },
            package_hash: { type: 'string', description: 'Hash of the package version' },
            metadata: { type: 'object', description: 'New metadata to apply' },
          },
          required: ['package_name', 'package_hash', 'metadata'],
        },
        output_schema: {
          type: 'object',
          properties: {
            package_name: { type: 'string' },
            package_hash: { type: 'string' },
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
      case 'quilt-package-search':
        return this.searchPackages(args)
      case 'quilt-package-create':
        return this.createPackage(args)
      case 'quilt-metadata-update':
        return this.updateMetadata(args)
      default:
        throw new Error(`Unknown tool: ${toolId}`)
    }
  }

  // Search packages (mock implementation)
  async searchPackages(args) {
    const { query, max_results = 10 } = args

    // Mock search results
    const mockPackages = [
      {
        name: `mock-package-${query}`,
        hash: 'mock-hash-123',
        metadata: {
          description: `A mock package for ${query}`,
          created: new Date().toISOString(),
          size: Math.floor(Math.random() * 1000000),
        },
      },
      {
        name: `another-package-${query}`,
        hash: 'mock-hash-456',
        metadata: {
          description: `Another mock package for ${query}`,
          created: new Date().toISOString(),
          size: Math.floor(Math.random() * 1000000),
        },
      },
    ]

    return {
      packages: mockPackages.slice(0, max_results),
    }
  }

  // Create package (mock implementation)
  async createPackage(args) {
    const { name, description, files, meta } = args

    // Mock package creation
    const packageHash = `mock-new-hash-${Date.now()}`

    return {
      package_name: name,
      package_hash: packageHash,
      message: `Mock package '${name}' created successfully with ${files.length} files`,
    }
  }

  // Update metadata (mock implementation)
  async updateMetadata(args) {
    const { package_name, package_hash, metadata } = args

    return {
      package_name,
      package_hash,
      message: `Mock metadata updated for '${package_name}'`,
    }
  }
}

const mcpServer = new QuiltPackageMCPServer()

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
  console.log(`Quilt Package MCP Server running on port ${PORT}`)
})
