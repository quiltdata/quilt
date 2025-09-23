/**
 * Test script to verify SSE MCP client configuration
 * Run this in the browser console to test the SSE endpoint
 */
/* eslint-disable no-console */

async function testSSEConfiguration() {
  console.log('=== SSE MCP Configuration Test ===')

  // Test the current configuration
  const config = window.QUILT_CATALOG_CONFIG
  console.log('Current MCP endpoint:', config.mcpEndpoint)
  console.log('Expected endpoint: https://demo.quiltdata.com/mcp')

  // Test MCP endpoint directly

  // Test SSE endpoint support
  try {
    console.log('Testing SSE endpoint support...')

    const sseResponse = await fetch(config.mcpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'sse-test',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, prompts: {}, resources: {} },
          clientInfo: { name: 'sse-test-client', version: '1.0.0' },
        },
      }),
    })

    if (sseResponse.ok) {
      const contentType = sseResponse.headers.get('content-type')
      console.log('SSE response content-type:', contentType)

      if (contentType && contentType.includes('text/event-stream')) {
        console.log('✅ SSE endpoint supported')

        const responseText = await sseResponse.text()
        console.log('SSE response preview:', `${responseText.substring(0, 300)}...`)

        // Try to parse SSE format
        let mcpData = null
        if (responseText.includes('event:') && responseText.includes('data:')) {
          const lines = responseText.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                mcpData = JSON.parse(line.substring(6))
                break
              } catch (e) {
                // Continue to next line
              }
            }
          }
        }

        if (mcpData && (mcpData.result || mcpData.error)) {
          console.log('✅ MCP protocol compatible')
          console.log('MCP response:', mcpData)
        } else {
          console.log('❌ MCP protocol incompatible')
        }
      } else {
        console.log('⚠️ Response not SSE format, content-type:', contentType)
      }
    } else {
      console.log(
        '❌ SSE endpoint test failed:',
        sseResponse.status,
        sseResponse.statusText,
      )
    }
  } catch (error) {
    console.log('❌ SSE endpoint test error:', error.message)
  }

  // Test tools list with SSE
  try {
    console.log('Testing tools list with SSE...')

    const toolsResponse = await fetch(config.mcpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-test',
        method: 'tools/list',
        params: {},
      }),
    })

    if (toolsResponse.ok) {
      const toolsText = await toolsResponse.text()
      console.log('Tools SSE response preview:', `${toolsText.substring(0, 300)}...`)

      // Parse SSE format
      let toolsData = null
      if (toolsText.includes('event:') && toolsText.includes('data:')) {
        const lines = toolsText.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              toolsData = JSON.parse(line.substring(6))
              break
            } catch (e) {
              // Continue
            }
          }
        }
      }

      if (toolsData && toolsData.result && toolsData.result.tools) {
        console.log(`✅ Found ${toolsData.result.tools.length} tools`)
        console.log(
          'First few tools:',
          toolsData.result.tools.slice(0, 3).map((t) => t.name),
        )
      } else {
        console.log('❌ No tools found in response:', toolsData)
      }
    } else {
      console.log('❌ Tools list failed:', toolsResponse.status, toolsResponse.statusText)
    }
  } catch (error) {
    console.log('❌ Tools list error:', error.message)
  }

  console.log('=== SSE Test Complete ===')
}

// Also test the built-in verification method
async function testBuiltInVerification() {
  console.log('=== Testing Built-in SSE Verification ===')

  try {
    // Import the MCP client (this assumes it's available globally)
    if (window.mcpClient) {
      const verification = await window.mcpClient.verifySSEEndpoint()
      console.log('Built-in verification result:', verification)
    } else {
      console.log('⚠️ MCP client not available globally, skipping built-in verification')
    }
  } catch (error) {
    console.log('❌ Built-in verification error:', error.message)
  }
}

// Run both tests
async function runAllTests() {
  await testSSEConfiguration()
  await testBuiltInVerification()
}

// Run the tests
runAllTests()
