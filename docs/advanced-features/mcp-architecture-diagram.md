# MCP Integration Architecture Diagram

## System Overview

This document provides visual representations of the MCP integration architecture implemented in the Qurator feature.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Quilt Frontend"
        A[User Interface] --> B[Qurator Chat]
        B --> C[MCP Context Provider]
        C --> D[Dynamic Auth Manager]
        D --> E[Enhanced Token Generator]
        D --> F[AWS Bucket Discovery]
        C --> G[MCP Client]
    end
    
    subgraph "Authentication Layer"
        H[Redux Token Store] --> D
        I[OAuth Provider] --> D
        J[IAM Role Service] --> D
    end
    
    subgraph "MCP Servers"
        K[Package MCP Server]
        L[Visualization MCP Server]
        M[Custom MCP Servers]
    end
    
    subgraph "AWS Services"
        N[S3 Buckets]
        O[IAM Roles]
        P[Bedrock AI]
    end
    
    G --> K
    G --> L
    G --> M
    
    F --> N
    F --> O
    B --> P
    
    E --> |Compressed JWT| G
    F --> |Bucket List| E
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Q as Qurator
    participant DAM as DynamicAuthManager
    participant ETG as EnhancedTokenGenerator
    participant BDS as BucketDiscoveryService
    participant MCP as MCP Server
    
    U->>Q: Ask question
    Q->>DAM: Get authentication token
    DAM->>BDS: Discover accessible buckets
    BDS-->>DAM: Return bucket list
    DAM->>ETG: Generate JWT with buckets
    ETG->>ETG: Compress JWT token
    ETG-->>DAM: Return compressed JWT
    DAM-->>Q: Return token
    Q->>MCP: Send request with JWT
    MCP->>MCP: Decompress JWT
    MCP-->>Q: Return response
    Q-->>U: Display answer
```

## JWT Token Compression Process

```mermaid
graph LR
    subgraph "Original JWT Payload"
        A1[scope: 'write'] --> B1[Field Abbreviation]
        A2[permissions: ['s3:GetObject', 's3:PutObject']] --> B2[Permission Compression]
        A3[roles: ['ReadWriteQuiltV2-sales-prod']] --> B3[Keep as-is]
        A4[buckets: ['quilt-sandbox', 'quilt-sales-raw', ...]] --> B4[Bucket Compression]
    end
    
    subgraph "Compressed JWT Payload"
        B1 --> C1[s: 'w']
        B2 --> C2[p: ['g', 'p']]
        B3 --> C3[r: ['ReadWriteQuiltV2-sales-prod']]
        B4 --> C4[b: {_type: 'groups', _data: {...}}]
    end
    
    subgraph "Size Reduction"
        D1[42,330 chars] --> D2[4,084 chars]
        D2 --> D3[90.3% reduction]
    end
```

## Bucket Discovery Process

```mermaid
graph TD
    A[User Login] --> B[Get Redux Token]
    B --> C[Extract Role Information]
    C --> D[Check Cache]
    D --> E{Cache Valid?}
    E -->|Yes| F[Return Cached Buckets]
    E -->|No| G[Query AWS IAM]
    G --> H[Extract Bucket Permissions]
    H --> I[Filter by Role Access]
    I --> J[Cache Results]
    J --> K[Return Bucket List]
    F --> L[Generate JWT Token]
    K --> L
    L --> M[Compress Token]
    M --> N[Send to MCP Server]
```

## MCP Tool Execution Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Q as Qurator
    participant MC as MCP Client
    participant MS as MCP Server
    participant T as Tool Executor
    participant S3 as S3 Service
    
    U->>Q: "Create a package from my data"
    Q->>MC: Execute tool: package_create
    MC->>MS: Call tool with JWT
    MS->>MS: Validate permissions
    MS->>T: Execute package creation
    T->>S3: Access S3 buckets
    S3-->>T: Return data
    T-->>MS: Package created
    MS-->>MC: Success response
    MC-->>Q: Tool result
    Q-->>U: "Package created successfully"
```

## Error Handling and Fallback

```mermaid
graph TD
    A[Tool Execution Request] --> B[Primary Auth Method]
    B --> C{Success?}
    C -->|Yes| D[Execute Tool]
    C -->|No| E[Fallback to IAM Role]
    E --> F{Success?}
    F -->|Yes| D
    F -->|No| G[Return Error]
    
    D --> H{Tool Execution Success?}
    H -->|Yes| I[Return Result]
    H -->|No| J[Retry with Backoff]
    J --> K{Max Retries?}
    K -->|No| D
    K -->|Yes| L[Return Error with Details]
    
    G --> M[Log Error]
    L --> M
    M --> N[User Notification]
```

## Security Layers

```mermaid
graph TB
    subgraph "Frontend Security"
        A1[JWT Token Signing]
        A2[Token Expiration]
        A3[Role Validation]
        A4[Permission Checking]
    end
    
    subgraph "Network Security"
        B1[HTTPS/TLS]
        B2[CORS Configuration]
        B3[Request Validation]
        B4[Rate Limiting]
    end
    
    subgraph "Backend Security"
        C1[JWT Verification]
        C2[Permission Validation]
        C3[AWS IAM Integration]
        C4[Audit Logging]
    end
    
    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4
    
    B1 --> C1
    B2 --> C2
    B3 --> C3
    B4 --> C4
```

## Performance Optimization

```mermaid
graph LR
    subgraph "Caching Strategy"
        A1[Token Cache] --> A2[10 min TTL]
        A3[Bucket Cache] --> A4[10 min TTL]
        A5[Role Cache] --> A6[5 min TTL]
    end
    
    subgraph "Compression Strategy"
        B1[Field Abbreviation] --> B2[Size Reduction]
        B3[Permission Compression] --> B2
        B4[Bucket Grouping] --> B2
        B5[Base64 Encoding] --> B2
    end
    
    subgraph "Network Optimization"
        C1[Connection Pooling] --> C2[Reduced Latency]
        C3[Batch Operations] --> C2
        C4[Compressed Payloads] --> C2
    end
    
    A2 --> B2
    A4 --> B2
    A6 --> B2
    B2 --> C2
```

## Component Relationships

```mermaid
classDiagram
    class MCPContextProvider {
        +state: MCPState
        +authManager: DynamicAuthManager
        +client: QuiltMCPClient
        +initializeMCP()
        +updateRoleInfo()
    }
    
    class DynamicAuthManager {
        +tokenGenerator: EnhancedTokenGenerator
        +bucketDiscovery: AWSBucketDiscoveryService
        +getCurrentToken()
        +getCurrentBuckets()
        +setRoleInfo()
    }
    
    class EnhancedTokenGenerator {
        +signingSecret: string
        +signingKeyId: string
        +generateEnhancedToken()
        +compressJWT()
    }
    
    class AWSBucketDiscoveryService {
        +cache: Map
        +cacheTimeout: number
        +getAccessibleBuckets()
        +_queryAwsIamForBuckets()
    }
    
    class QuiltMCPClient {
        +endpoint: string
        +currentRole: Role
        +getHeaders()
        +executeTool()
        +callTool()
    }
    
    MCPContextProvider --> DynamicAuthManager
    MCPContextProvider --> QuiltMCPClient
    DynamicAuthManager --> EnhancedTokenGenerator
    DynamicAuthManager --> AWSBucketDiscoveryService
    QuiltMCPClient --> DynamicAuthManager
```

## Data Flow Summary

1. **User Interaction**: User asks question in Qurator chat
2. **Authentication**: DynamicAuthManager retrieves and validates user token
3. **Bucket Discovery**: AWSBucketDiscoveryService finds accessible S3 buckets
4. **Token Generation**: EnhancedTokenGenerator creates compressed JWT with all claims
5. **MCP Communication**: QuiltMCPClient sends request to MCP server with JWT
6. **Tool Execution**: MCP server decompresses JWT and executes requested tool
7. **Response**: Results are returned to user through Qurator interface

This architecture ensures secure, efficient, and scalable MCP integration while maintaining compatibility with existing Quilt infrastructure.
