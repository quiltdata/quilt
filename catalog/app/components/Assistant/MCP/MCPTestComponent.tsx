import React, { useState, useEffect } from 'react'
import { mcpClient } from './Client'

const MCPTestComponent: React.FC = () => {
  const [status, setStatus] = useState<string>('Loading...')
  const [tools, setTools] = useState<any[]>([])
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  useEffect(() => {
    const initializeMCP = async () => {
      try {
        setStatus('Initializing MCP connection...')
        await mcpClient.initialize()
        setIsInitialized(true)
        setStatus('Connected! Loading tools...')

        const availableTools = await mcpClient.listAvailableTools()
        setTools(availableTools)
        setStatus(`Connected! Found ${availableTools.length} tools`)
      } catch (error) {
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsInitialized(false)
      }
    }

    initializeMCP()
  }, [])

  return (
    <div
      style={{
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        margin: '20px',
      }}
    >
      <h3>MCP Test - Enhanced</h3>
      <div>
        <strong>Status:</strong> {status}
      </div>
      <div>
        <strong>Available Tools ({tools.length})</strong>
        {tools.length > 0 ? (
          <ul style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '10px' }}>
            {tools.map((tool, index) => (
              <li key={index} style={{ marginBottom: '8px' }}>
                <strong>{tool.name}</strong>: {tool.description}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
            {isInitialized ? 'No tools available' : 'Loading tools...'}
          </div>
        )}
      </div>
      <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
        This component demonstrates MCP Client functionality.
      </div>
    </div>
  )
}

export default MCPTestComponent
