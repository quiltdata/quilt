# MCP Integration Tasks

## Phase 1: Foundation Setup

### 1.1 Project Structure
- [x] Create `app/components/Agent/` directory
- [x] Create `app/components/Agent/Model/` subdirectory
- [x] Create `app/components/Agent/UI/` subdirectory
- [x] Create `app/components/Agent/index.ts` entry point
- [ ] Add TypeScript path alias for Agent component

### 1.2 Routing Setup
- [x] Add `/agent` route to app router configuration
- [x] Create `AgentPage.tsx` component
- [x] Add navigation link to Agent in app header/menu
- [ ] Add route protection/feature flag if needed

## Phase 2: Basic UI Implementation

### 2.1 Chat Interface
- [x] Create `app/components/Agent/UI/AgentChat.tsx`
- [x] Set up basic chat layout
- [x] Add message list component
- [x] Create input field with send button
- [x] Implement message rendering
- [x] Add auto-scroll to latest message

### 2.2 Message Components
- [x] Create message bubble component
- [x] Add user/assistant message distinction
- [x] Implement timestamp display
- [x] Add message loading state
- [x] Create empty state placeholder

### 2.3 Basic Interaction
- [x] Wire up input submission
- [x] Add local message state management
- [x] Implement dummy response generation
- [x] Test chat flow without backend
- [x] Add basic keyboard shortcuts (Enter to send)

## Phase 3: MCP Foundation

### 3.1 Core Dependencies
- [ ] Add `@modelcontextprotocol/sdk` to package.json
- [ ] Run npm install to fetch dependencies
- [ ] Verify SDK imports work correctly
- [ ] Check Effect.ts version compatibility

### 3.2 MCP SDK Integration
- [ ] Create `app/components/Agent/Model/MCPClient.ts`
- [ ] Import SDK Client and HTTPTransport
- [ ] Define client initialization function
- [ ] Add connection state management
- [ ] Implement disconnect/cleanup methods

### 3.3 Server Configuration
- [ ] Create `app/components/Agent/Model/config.ts`
- [ ] Define MCP server endpoint constants
- [ ] Configure CORS proxy if needed
- [ ] Add environment-based configuration
- [ ] Set up connection timeout values

### 3.4 Test Server Integration
- [ ] Research available public MCP servers
- [ ] Test connectivity to selected server
- [ ] Document server URL and capabilities
- [ ] Create fallback/mock server option
- [ ] Verify tool listing works

## Phase 4: Tool System Integration

### 4.1 Tool Adapter
- [ ] Create `app/components/Agent/Model/MCPToolAdapter.ts`
- [ ] Define `MCPTool` to `Tool.Descriptor` interface
- [ ] Implement schema conversion function
- [ ] Add parameter mapping logic
- [ ] Create result transformation methods
- [ ] Handle optional/required parameters

### 4.2 Tool Registry
- [ ] Create `app/components/Agent/Model/ToolRegistry.ts`
- [ ] Implement tool storage Map/Record
- [ ] Add `registerTools()` method
- [ ] Create `getToolByName()` lookup
- [ ] Add `listAvailableTools()` method
- [ ] Implement tool caching logic

### 4.3 Execution Bridge
- [ ] Create `app/components/Agent/Model/ToolExecutor.ts`
- [ ] Wrap SDK `callTool()` in Effect.Effect
- [ ] Map MCP responses to Tool.Result
- [ ] Add error handling and recovery
- [ ] Implement execution timeout
- [ ] Add execution logging

## Phase 5: LLM Integration

### 5.1 Conversation Setup
- [x] Copy `Conversation.ts` from Assistant
- [x] Copy base Content types
- [x] Copy Tool.ts for tool handling
- [ ] Extend with MCP-specific messages
- [x] Implement conversation state machine
- [x] Add message history management

### 5.2 Bedrock Connection
- [x] Create `app/components/Agent/Model/Agent.tsx`
- [x] Copy and adapt Bedrock.ts
- [x] Copy LLM.ts interface
- [x] Configure model ID (Claude)
- [x] Implement conversation flow orchestration
- [x] Add streaming response handling

### 5.3 Context Management
- [x] Create simplified Agent provider
- [x] Wire up chat UI with real LLM
- [x] Remove unnecessary show/hide/ask APIs
- [ ] Add MCP connection status
- [ ] Track available MCP tools
- [ ] Store MCP execution history

## Phase 6: Enhanced UI Components

### 6.1 Tool Visualization
- [x] Tool execution display in AgentChat
- [x] Tool call indicator component
- [x] Parameter display with JsonDisplay
- [x] Result visualization
- [x] Loading/pending states
- [x] Error state display

### 6.2 Server Status (MCP-specific)
- [ ] Create `app/components/Agent/UI/ServerStatus.tsx`
- [ ] Add MCP connection status badge
- [ ] Display MCP server name/URL
- [ ] Show available MCP tools count
- [ ] Add reconnect button
- [ ] Implement connection error display

## Phase 7: Testing & Refinement

### 7.1 Integration Testing
- [ ] Write test for MCP client connection
- [ ] Test tool discovery flow
- [ ] Verify tool execution with mock data
- [ ] Test error recovery scenarios
- [ ] Add E2E test for full conversation

### 7.2 UI/UX Testing
- [ ] Test responsive layout on different screens
- [ ] Verify keyboard navigation
- [ ] Check loading state transitions
- [ ] Test error message clarity
- [ ] Validate accessibility (ARIA labels)

### 7.3 Documentation
- [ ] Create `spec/agent-mcp/README.md` usage guide
- [ ] Document API interfaces in code
- [ ] Add JSDoc comments to key functions
- [ ] Create troubleshooting section
- [ ] Write developer setup guide

## Notes

- Each task should be completed and tested before moving to the next
- Update checkbox markers as work progresses
- Add new tasks if discovered during implementation
- Document blockers with explanation when encountered