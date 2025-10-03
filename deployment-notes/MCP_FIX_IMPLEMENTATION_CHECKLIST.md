# MCP Authentication Fix - Implementation Checklist

## Quick Summary
The frontend is sending unenhanced JWT tokens to MCP endpoints instead of enhanced JWTs with roles, permissions, and buckets. This causes the MCP server to fall back to IAM authentication.

## Root Cause
- Frontend generates basic JWT tokens but doesn't properly generate enhanced JWTs
- MCP client sends old, unenhanced tokens in Authorization headers
- Race condition between `get_credentials` and MCP calls

## Implementation Steps

### 1. Fix Enhanced Token Generator
**File**: `catalog/app/services/EnhancedTokenGenerator.js`
- [ ] Add debugging logs to confirm enhanced tokens are generated
- [ ] Verify the generator is properly exported and used
- [ ] Add validation to ensure enhanced tokens have required claims

### 2. Fix Dynamic Auth Manager
**File**: `catalog/app/services/DynamicAuthManager.js`
- [ ] Ensure `getCurrentToken()` returns enhanced tokens only
- [ ] Add cache invalidation when switching from basic to enhanced tokens
- [ ] Add proper error handling for token generation failures
- [ ] Add validation method for enhanced tokens

### 3. Fix MCP Client
**File**: `catalog/app/components/Assistant/MCP/Client.ts`
- [ ] Fix `validateEnhancedToken()` method to properly detect enhanced tokens
- [ ] Ensure validation happens before every MCP request
- [ ] Add proper error handling and token refresh logic
- [ ] Clear token cache when enhanced tokens are available

### 4. Fix Authentication Flow
**Files**: Authentication-related files
- [ ] Ensure `get_credentials` response triggers enhanced token generation
- [ ] Coordinate between `DynamicAuthManager` and `QuiltMCPClient`
- [ ] Add proper event handling for token updates

## Testing Steps

### Frontend Testing
- [ ] Run cross-verification test script in browser console
- [ ] Verify enhanced tokens are generated and cached properly
- [ ] Check MCP client sends correct Authorization headers
- [ ] Monitor browser network tab for proper token usage

### Backend Testing
- [ ] Check CloudWatch logs for enhanced JWT processing
- [ ] Verify no fallback to IAM authentication
- [ ] Confirm user permissions are properly extracted from JWT
- [ ] Test MCP tools work with enhanced authentication

## Success Criteria
- [ ] Enhanced JWTs generated with roles, permissions, and buckets
- [ ] MCP client sends enhanced JWTs in Authorization headers
- [ ] MCP server processes enhanced JWTs without IAM fallback
- [ ] User authentication shows as JWT-based, not IAM-only
- [ ] No race conditions between authentication calls

## Key Files to Modify
1. `catalog/app/services/EnhancedTokenGenerator.js`
2. `catalog/app/services/DynamicAuthManager.js`
3. `catalog/app/components/Assistant/MCP/Client.ts`
4. Authentication flow integration files

## Expected Outcome
After implementation:
1. Frontend generates enhanced JWTs with proper claims
2. MCP client sends enhanced JWTs in all requests
3. MCP server processes enhanced JWTs successfully
4. User sees JWT-based authentication instead of IAM-only
5. All MCP functionality works with proper user permissions

## Debugging
- Check browser console for authentication errors
- Monitor CloudWatch logs for JWT processing
- Use the cross-verification test script to validate tokens
- Check network tab for proper Authorization headers

## Rollback Plan
If issues arise:
1. Revert to previous Docker image
2. Clear browser cache
3. Monitor logs for authentication errors
4. Debug token generation and validation


