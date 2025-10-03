# MCP Authentication Fix - Complete Specification

## Problem Summary

The Quilt frontend is experiencing a critical authentication issue where:

1. **Frontend sends unenhanced JWT tokens** to MCP endpoints instead of enhanced JWTs with roles, permissions, and buckets
2. **MCP server falls back to IAM authentication** because it cannot parse the unenhanced tokens
3. **Race condition exists** between `get_credentials` call and MCP `initialize`/`notifications/initialized` calls
4. **User authentication shows as IAM-only** instead of proper JWT-based authentication

## Current Evidence

### Frontend Behavior (from curl analysis):
```bash
# 1. get_credentials call - uses old token
curl 'https://demo-registry.quiltdata.com/api/auth/get_credentials' \
  -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6Ijg3OTVmMGNjLThkZWItNDBkZC05MTMyLTEzMzU3Yzk4Mzk4NCIsInV1aWQiOiJmYzg5MTFiZi1jMmIyLTRlMTgtOWMwYy0wYzVlYzlhNmYxNzciLCJleHAiOjE3NjcwNTQwMTB9.-JZl6Ahpx1_AMw2L6fI63uurQwPYJAzXlQy1YtttaWo'

# 2. MCP initialize call - NO Authorization header
curl 'https://demo.quiltdata.com/mcp/?t=1759321134189' \
  --data-raw '{"jsonrpc":"2.0","id":"init-session","method":"initialize",...}'

# 3. MCP notifications/initialized call - uses OLD token again
curl 'https://demo.quiltdata.com/mcp/?t=1759321134275' \
  -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6Ijg3OTVmMGNjLThkZWItNDBkZC05MTMyLTEzMzU3Yzk4Mzk4NCIsInV1aWQiOiJmYzg5MTFiZi1jMmIyLTRlMTgtOWMwYy0wYzVlYzlhNmYxNzciLCJleHAiOjE3NjcwNTQwMTB9.-JZl6Ahpx1_AMw2L6fI63uurQwPYJAzXlQy1YtttaWo'
```

### Backend Behavior (from CloudWatch logs):
```
WARNING:quilt_mcp.tools.buckets:⚠️  FALLING BACK to traditional authentication for list_available_resources (environment: web-unauthenticated)
WARNING:quilt_mcp.tools.buckets:This means NO JWT was found in runtime context!
WARNING:quilt_mcp.utils:MCP session default-session: No auth header for initialize, allowing for initialization
WARNING:quilt_mcp.utils:⚠️  Setting runtime context to UNAUTHENTICATED - tools will NOT have JWT!
```

## Root Cause Analysis

1. **Token Generation Issue**: The `DynamicAuthManager` is not properly generating enhanced JWTs
2. **Token Caching Issue**: The frontend is caching and reusing old, unenhanced tokens
3. **Race Condition**: MCP calls happen before enhanced token is available
4. **Token Validation Issue**: The validation logic we added isn't preventing unenhanced tokens from being sent

## Required Fixes

### 1. Frontend Token Generation Fix

**File**: `catalog/app/services/EnhancedTokenGenerator.js`

**Issue**: The enhanced token generator may not be properly integrated with the authentication flow.

**Required Changes**:
- Ensure `DynamicAuthManager` always calls the enhanced token generator
- Verify the enhanced token generator is being used for MCP requests
- Add debugging to confirm enhanced tokens are being generated

### 2. Frontend Token Caching Fix

**File**: `catalog/app/services/DynamicAuthManager.js`

**Issue**: The auth manager is caching unenhanced tokens and not properly refreshing them.

**Required Changes**:
- Clear cache when enhanced tokens are available
- Ensure `getCurrentToken()` returns enhanced tokens only
- Add cache invalidation when switching from unenhanced to enhanced tokens

### 3. MCP Client Token Validation Fix

**File**: `catalog/app/components/Assistant/MCP/Client.ts`

**Issue**: The validation logic we added isn't working properly.

**Required Changes**:
- Fix the `validateEnhancedToken` method to properly detect enhanced tokens
- Ensure validation happens before every MCP request
- Add proper error handling and token refresh logic

### 4. Authentication Flow Integration

**Files**: Multiple authentication-related files

**Issue**: The authentication flow isn't properly coordinated between components.

**Required Changes**:
- Ensure `get_credentials` response triggers enhanced token generation
- Coordinate between `DynamicAuthManager` and `QuiltMCPClient`
- Add proper event handling for token updates

## Implementation Plan

### Phase 1: Debug Current State
1. Add comprehensive logging to track token flow
2. Verify enhanced token generation is working
3. Check token validation logic
4. Confirm MCP client is receiving enhanced tokens

### Phase 2: Fix Token Generation
1. Ensure `DynamicAuthManager` generates enhanced tokens
2. Fix any issues with the enhanced token generator
3. Add proper error handling for token generation failures

### Phase 3: Fix Token Caching
1. Implement proper cache invalidation
2. Ensure old tokens are discarded when enhanced tokens are available
3. Add cache debugging and monitoring

### Phase 4: Fix MCP Integration
1. Ensure MCP client uses enhanced tokens
2. Fix validation logic to properly detect enhanced tokens
3. Add proper error handling and retry logic

### Phase 5: Testing and Validation
1. Test the complete authentication flow
2. Verify MCP server receives enhanced tokens
3. Confirm user authentication shows as JWT-based, not IAM-only

## Success Criteria

1. **Frontend generates enhanced JWTs** with roles, permissions, and buckets
2. **MCP client sends enhanced JWTs** in Authorization headers
3. **MCP server processes enhanced JWTs** without falling back to IAM
4. **User authentication shows as JWT-based** in logs and UI
5. **No race conditions** between authentication calls

## Testing Strategy

### Frontend Testing
1. Run the cross-verification test script in browser console
2. Verify enhanced tokens are generated and cached properly
3. Check MCP client sends correct Authorization headers
4. Monitor browser network tab for proper token usage

### Backend Testing
1. Check CloudWatch logs for enhanced JWT processing
2. Verify no fallback to IAM authentication
3. Confirm user permissions are properly extracted from JWT
4. Test MCP tools work with enhanced authentication

### Integration Testing
1. Test complete user login flow
2. Verify MCP functionality works end-to-end
3. Check authentication state in UI
4. Monitor for any authentication errors

## Files to Modify

### Primary Files
- `catalog/app/services/EnhancedTokenGenerator.js`
- `catalog/app/services/DynamicAuthManager.js`
- `catalog/app/components/Assistant/MCP/Client.ts`

### Secondary Files
- `catalog/app/services/auth.js` (if exists)
- `catalog/app/utils/Config.ts`
- Any other authentication-related files

### Configuration Files
- `catalog/config.json.tmpl`
- Environment variables for JWT secrets

## Expected Outcome

After implementing these fixes:

1. **Enhanced JWTs will be generated** with proper roles, permissions, and buckets
2. **MCP client will send enhanced JWTs** in all requests
3. **MCP server will process enhanced JWTs** and provide proper authentication
4. **User will see JWT-based authentication** instead of IAM-only
5. **All MCP functionality will work** with proper user permissions

## Monitoring and Debugging

### Key Log Messages to Look For
- `✅ Enhanced JWT generated` (frontend)
- `✅ MCP Request with enhanced JWT` (frontend)
- `✅ JWT authentication successful` (backend)
- `❌ JWT validation failed` (should not appear)

### CloudWatch Log Groups
- `/ecs/mcp-server-production` - MCP server logs
- `sales-prod` - Frontend nginx logs

### Browser Console
- Run the cross-verification test script
- Check for authentication errors
- Monitor network requests for proper headers

This specification provides a complete roadmap for fixing the MCP authentication issue and ensuring proper JWT-based authentication throughout the system.


