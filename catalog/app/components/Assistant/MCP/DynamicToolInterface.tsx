/**
 * Dynamic Tool Interface Component
 *
 * This component provides a dynamic interface for executing any MCP tool
 * loaded from the server.
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import { useGenericToolExecutor } from './tools/GenericToolExecutor'
import type { MCPClient, MCPTool } from './types'

interface DynamicToolInterfaceProps {
  mcpClient: MCPClient
}

export const DynamicToolInterface: React.FC<DynamicToolInterfaceProps> = ({
  mcpClient,
}) => {
  const [tools, setTools] = React.useState<MCPTool[]>([])
  const [selectedTool, setSelectedTool] = React.useState<MCPTool | null>(null)
  const [toolArguments, setToolArguments] = React.useState<Record<string, any>>({})
  const [executionResult, setExecutionResult] = React.useState<string>('')
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [error, setError] = React.useState<string>('')

  const { executeTool, getAvailableTools, validateToolArguments } =
    useGenericToolExecutor(mcpClient)

  // Load available tools on component mount
  React.useEffect(() => {
    const loadTools = async () => {
      try {
        const availableTools = await getAvailableTools()
        setTools(availableTools)
        if (availableTools.length > 0) {
          setSelectedTool(availableTools[0])
        }
      } catch (err) {
        setError(`Failed to load tools: ${err}`)
      }
    }

    loadTools()
  }, [getAvailableTools])

  // Reset arguments when tool changes
  React.useEffect(() => {
    if (selectedTool) {
      setToolArguments({})
      setExecutionResult('')
      setError('')
    }
  }, [selectedTool])

  const handleToolSelect = (toolName: string) => {
    const tool = tools.find((t) => t.name === toolName)
    setSelectedTool(tool || null)
  }

  const handleArgumentChange = (field: string, value: any) => {
    setToolArguments((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleExecute = async () => {
    if (!selectedTool) return

    setIsExecuting(true)
    setError('')
    setExecutionResult('')

    try {
      // Validate arguments
      const validation = validateToolArguments(selectedTool, toolArguments)
      if (!validation.valid) {
        setError(`Validation errors: ${validation.errors.join(', ')}`)
        setIsExecuting(false)
        return
      }

      // Execute the tool
      const result = await executeTool(selectedTool.name, toolArguments)

      if (result.success && result.result) {
        setExecutionResult(JSON.stringify(result.result, null, 2))
      } else {
        setError(result.error || 'Tool execution failed')
      }
    } catch (err) {
      setError(`Execution error: ${err}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const renderArgumentInput = (field: string, schema: any) => {
    const value = toolArguments[field] || ''
    const isRequired = selectedTool?.inputSchema?.required?.includes(field) || false

    switch (schema.type) {
      case 'string':
        return (
          <M.TextField
            key={field}
            label={`${field}${isRequired ? ' *' : ''}`}
            value={value}
            onChange={(e) => handleArgumentChange(field, e.target.value)}
            fullWidth
            margin="normal"
            helperText={schema.description}
          />
        )

      case 'number':
        return (
          <M.TextField
            key={field}
            label={`${field}${isRequired ? ' *' : ''}`}
            type="number"
            value={value}
            onChange={(e) => handleArgumentChange(field, parseFloat(e.target.value) || 0)}
            fullWidth
            margin="normal"
            helperText={schema.description}
          />
        )

      case 'boolean':
        return (
          <M.FormControlLabel
            key={field}
            control={
              <M.Checkbox
                checked={value}
                onChange={(e) => handleArgumentChange(field, e.target.checked)}
              />
            }
            label={`${field}${isRequired ? ' *' : ''}`}
          />
        )

      case 'array':
        return (
          <M.TextField
            key={field}
            label={`${field}${isRequired ? ' *' : ''}`}
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) =>
              handleArgumentChange(
                field,
                e.target.value.split(',').map((s) => s.trim()),
              )
            }
            fullWidth
            margin="normal"
            helperText={`${schema.description} (comma-separated values)`}
          />
        )

      default:
        return (
          <M.TextField
            key={field}
            label={`${field}${isRequired ? ' *' : ''}`}
            value={typeof value === 'string' ? value : JSON.stringify(value)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleArgumentChange(field, parsed)
              } catch {
                handleArgumentChange(field, e.target.value)
              }
            }}
            fullWidth
            margin="normal"
            helperText={`${schema.description} (JSON format)`}
          />
        )
    }
  }

  return (
    <M.Paper style={{ padding: 20, margin: 20 }}>
      <M.Typography variant="h5" gutterBottom>
        Dynamic MCP Tool Interface
      </M.Typography>

      {error && (
        <M.Paper
          style={{
            padding: 15,
            marginBottom: 20,
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
          }}
        >
          <M.Typography variant="body2" style={{ color: '#d32f2f' }}>
            {error}
          </M.Typography>
        </M.Paper>
      )}

      {/* Tool Selection */}
      <M.FormControl fullWidth margin="normal">
        <M.InputLabel>Select Tool</M.InputLabel>
        <M.Select
          value={selectedTool?.name || ''}
          onChange={(e) => handleToolSelect(e.target.value as string)}
        >
          {tools.map((tool) => (
            <M.MenuItem key={tool.name} value={tool.name}>
              {tool.name} - {tool.description}
            </M.MenuItem>
          ))}
        </M.Select>
      </M.FormControl>

      {/* Tool Description */}
      {selectedTool && (
        <M.Card style={{ margin: '20px 0', padding: 15 }}>
          <M.Typography variant="h6">Tool Description</M.Typography>
          <M.Typography variant="body2" color="textSecondary">
            {selectedTool.description}
          </M.Typography>
        </M.Card>
      )}

      {/* Tool Arguments */}
      {selectedTool && selectedTool.inputSchema && (
        <M.Card style={{ margin: '20px 0', padding: 15 }}>
          <M.Typography variant="h6" gutterBottom>
            Tool Arguments
          </M.Typography>
          {Object.entries(selectedTool.inputSchema.properties || {}).map(
            ([field, schema]) => renderArgumentInput(field, schema),
          )}
        </M.Card>
      )}

      {/* Execute Button */}
      <M.Button
        variant="contained"
        color="primary"
        onClick={handleExecute}
        disabled={!selectedTool || isExecuting}
        style={{ margin: '20px 0' }}
      >
        {isExecuting ? 'Executing...' : 'Execute Tool'}
      </M.Button>

      {/* Execution Result */}
      {executionResult && (
        <M.Card style={{ margin: '20px 0', padding: 15 }}>
          <M.Typography variant="h6" gutterBottom>
            Execution Result
          </M.Typography>
          <M.TextField
            multiline
            rows={10}
            value={executionResult}
            variant="outlined"
            fullWidth
            InputProps={{
              readOnly: true,
              style: { fontFamily: 'monospace', fontSize: '12px' },
            }}
          />
        </M.Card>
      )}
    </M.Paper>
  )
}
