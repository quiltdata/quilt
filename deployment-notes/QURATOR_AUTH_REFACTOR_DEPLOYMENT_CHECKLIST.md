# Qurator Authentication Refactor - Pre-Deployment Checklist

**Date:** October 1, 2025  
**Critical Issue:** Conflicting authentication approaches detected

---

## ⚠️ CRITICAL: Architecture Conflict Detected

### The Problem

You have **TWO INCOMPATIBLE** authentication implementations:

#### ❌ Old Approach (COMPLETE_MCP_AUTH_FIX_SPECIFICATION.md)
- Creates "enhanced JWTs" in the browser
- Stores JWT signing secret (`mcpEnhancedJwtSecret`) in frontend config
- Signs tokens client-side with roles, permissions, buckets
- Uses compression/decompression for JWT claims
- Complex token enhancement flow with `DynamicAuthManager`

#### ✅ New Approach (Alexei's Recommendation)
- **Never** create or sign JWTs in browser
- **Never** store secrets in browser
- Reuse existing catalog auth token from local storage
- Backend is completely stateless
- Replace all Quilt3 calls with GraphQL/REST API

### Alexei's Direct Quote from Transcript

> **"Basically, I think for this case, you should just reuse the token. Catalog has a single token, authentication token, which is stored in local storage and is available in different places throughout the application code. And you should just send this token to the server, and then server can use this token to make requests to the backend, to all the endpoints in the registry."**

> **"Well, I realize that it's a demo, but it's like fundamentally wrong because you are keeping the secret in the browser and you are signing the token in the browser, that's, like, you can do this, really."** (when asked about security vs practicality: **"The secret is kept in the backend."**)

---

## Decision Required

Before proceeding, you must decide:

### Option A: Implement Alexei's Approach (Recommended)
- **Pros:**
  - Architecturally sound
  - No security issues
  - Simpler implementation
  - Recommended by lead architect
  - Will work in production long-term
  
- **Cons:**
  - Requires removing existing enhanced JWT code
  - Different from what's currently implemented
  - More backend refactoring needed

- **Timeline:** ~2-3 days of refactoring

### Option B: Keep Current Enhanced JWT Approach
- **Pros:**
  - Already implemented
  - Works for demo purposes
  - Can ship quickly
  
- **Cons:**
  - **Fundamentally insecure** (secrets in browser)
  - Not production-ready
  - Will need to be rewritten later
  - May not pass security review
  - Alexei won't support long-term

- **Timeline:** Deploy now, rewrite later

---

## Recommended Path: Hybrid Approach for Summit Demo

Given the tight timeline (Summit on Oct 15), here's a pragmatic approach:

### Phase 1: Minimal Secure Demo (For Summit - Oct 15)

#### Frontend Changes (Quick)
1. **Remove JWT creation from browser**
   - Delete `EnhancedTokenGenerator.js` logic that signs tokens
   - Remove `mcpEnhancedJwtSecret` from frontend config
   - Simplify `DynamicAuthManager` to just get token from Redux state

2. **Use existing catalog token**
   - Get token from local storage via Redux
   - Pass token directly to MCP server
   - No enhancement, no signing

3. **Files to modify:**
   ```
   catalog/app/components/Assistant/MCP/Client.ts
   catalog/app/components/Assistant/MCP/MCPContextProvider.tsx
   catalog/app/services/DynamicAuthManager.js (simplify drastically)
   ```

#### Backend Changes (Quick)
1. **Accept standard catalog auth token**
   - Validate using registry's validation endpoint
   - Don't expect enhanced claims
   - Extract permissions from registry API

2. **Use auth token for all API calls**
   - Pass token in headers to GraphQL/REST
   - Let registry handle authorization
   - Don't cache any auth state

### Phase 2: Full Production Implementation (Post-Summit)

Follow the complete specifications:
- `QURATOR_FRONTEND_AUTH_SPEC.md`
- `QURATOR_BACKEND_MCP_AUTH_SPEC.md`

---

## Pre-Deployment Checklist

### 🔴 Critical - Must Fix Before ANY Deployment

- [ ] **Remove JWT signing secrets from frontend code**
  - Check `catalog/config.json.tmpl`
  - Check environment variable files
  - Check any hardcoded secrets

- [ ] **Audit what's exposed to browser**
  - Search for `mcpEnhancedJwtSecret` in frontend code
  - Search for any `jwt.sign()` calls in browser code
  - Search for any crypto operations in browser

- [ ] **Backend statelessness verification**
  - No global variables for auth state
  - No cached credentials
  - No Quilt3 login/state storage
  - Each request is independent

### 🟡 Important - Should Fix Before Production

- [ ] **Replace Quilt3 calls with GraphQL/REST**
  - [ ] Package operations → GraphQL
  - [ ] Bucket operations → S3 API or GraphQL
  - [ ] Admin operations → REST API
  - [ ] User operations → REST API

- [ ] **Token handling refactor**
  - [ ] Frontend gets token from Redux state
  - [ ] Token passed with every MCP request
  - [ ] Backend extracts token from Authorization header
  - [ ] Backend forwards token to registry

- [ ] **Remove complexity from DynamicAuthManager**
  - [ ] Remove token enhancement logic
  - [ ] Remove bucket discovery (if not needed)
  - [ ] Simplify to just "get token from Redux"

### 🟢 Nice to Have - Can Fix Post-Demo

- [ ] **Error handling improvements**
  - [ ] Token expiration
  - [ ] Invalid token
  - [ ] Missing permissions

- [ ] **Monitoring and logging**
  - [ ] Auth success/failure metrics
  - [ ] Token validation logs
  - [ ] Performance metrics

- [ ] **Documentation**
  - [ ] Update architecture docs
  - [ ] Create runbook
  - [ ] Document token flow

---

## Files That Need Immediate Attention

### ❌ DELETE or DEPRECATE

```
catalog/app/services/EnhancedTokenGenerator.js
catalog/app/services/jwt-decompression-utils.js
catalog/app/services/MCP_Server_JWT_Decompression_Guide.md
catalog/app/services/JWTCompressionFormat.md
catalog/app/services/test-jwt-decompression.js
COMPLETE_MCP_AUTH_FIX_SPECIFICATION.md (old approach)
CROSS_VERIFICATION_TEST.js (tests wrong approach)
```

### ✏️ SIMPLIFY Drastically

```
catalog/app/services/DynamicAuthManager.js
  → Should be ~50 lines, not 500+
  → Just get token from Redux, that's it

catalog/app/components/Assistant/MCP/Client.ts
  → Remove enhanced token validation
  → Just get token and add to header

catalog/app/components/Assistant/MCP/MCPContextProvider.tsx
  → Remove token enhancement flow
  → Just pass Redux token to client
```

### ✅ KEEP and REFACTOR

```
catalog/app/services/mcpAuthorization.js
  → Still useful for role mapping
  → May need to work differently

catalog/app/services/BucketDiscoveryService.js
  → Still useful for finding buckets
  → May move to backend
```

---

## Security Audit Checklist

Before deploying to ANY environment:

### Frontend Security
- [ ] No secrets in frontend code
- [ ] No JWT signing in browser
- [ ] No crypto keys in config files
- [ ] No hardcoded credentials
- [ ] All API keys are backend-only

### Backend Security
- [ ] Secrets stored in SSM/environment variables
- [ ] No secrets in logs
- [ ] Tokens validated properly
- [ ] No auth state in global variables
- [ ] HTTPS only for all API calls

### Infrastructure Security
- [ ] Secrets rotation plan exists
- [ ] Environment variables properly isolated
- [ ] Docker containers don't expose secrets
- [ ] Network policies restrict access

---

## Testing Requirements

### Before Demo Deployment

#### Unit Tests
- [ ] Frontend token retrieval from Redux
- [ ] Backend token extraction from headers
- [ ] Token forwarding to registry APIs
- [ ] Error handling for missing tokens

#### Integration Tests
- [ ] End-to-end MCP request with real token
- [ ] Multiple concurrent users
- [ ] Role switching mid-session
- [ ] Token expiration handling

#### Security Tests
- [ ] No secrets in frontend bundle
- [ ] No tokens in logs
- [ ] Proper HTTPS enforcement
- [ ] Authorization checks work

### Manual Testing Checklist

- [ ] Log in to Qurator
- [ ] Open browser console
- [ ] Verify no secrets visible in Network tab
- [ ] Make MCP request
- [ ] Verify Authorization header present
- [ ] Check backend logs for proper auth
- [ ] Switch roles and verify it works
- [ ] Log out and verify MCP stops working

---

## Deployment Steps

### Step 1: Pre-Deployment
1. Run security audit
2. Remove all secrets from frontend
3. Test locally
4. Get code review from Alexei

### Step 2: Deploy Backend
1. Deploy MCP server with stateless auth
2. Verify environment variables set correctly
3. Check logs for auth errors
4. Test with curl/Postman

### Step 3: Deploy Frontend
1. Build frontend with secrets removed
2. Deploy to demo environment
3. Hard refresh browser (Cmd+Shift+R)
4. Test end-to-end flow
5. Monitor for errors

### Step 4: Validation
1. Run manual test checklist
2. Check CloudWatch logs
3. Verify no IAM fallback warnings
4. Test with multiple users
5. Confirm role switching works

---

## Rollback Plan

If deployment fails:

### Frontend Rollback
1. Revert to previous commit
2. Rebuild and redeploy
3. Hard refresh browser

### Backend Rollback
1. Revert to previous Docker image
2. Restart ECS task
3. Verify service health

### Data Cleanup
1. Clear browser cache
2. Clear local storage
3. Log out and log back in

---

## Known Risks and Mitigations

### Risk 1: Token Not Available
**Risk:** Redux token getter returns null  
**Mitigation:** Add fallback error handling, show user error message  
**Test:** Try MCP request before login

### Risk 2: Token Expired
**Risk:** Catalog token expires mid-session  
**Mitigation:** Listen for token refresh events in Redux  
**Test:** Force token expiration

### Risk 3: Backend Can't Validate Token
**Risk:** Backend can't reach registry to validate  
**Mitigation:** Proper error handling, retry logic  
**Test:** Simulate registry downtime

### Risk 4: Performance Degradation
**Risk:** Every request needs token from Redux  
**Mitigation:** Redux selectors are fast, minimal overhead  
**Test:** Load test with many concurrent requests

---

## Post-Deployment Monitoring

### Metrics to Watch

#### Frontend
- Token retrieval success rate
- Authorization header attachment rate
- MCP request success rate
- Error rate by error type

#### Backend
- Token validation success rate
- API call success rate to registry
- Response time percentiles
- Error rate by endpoint

### Alerts to Configure

- Auth token retrieval failures > 5%
- MCP request failures > 10%
- Backend auth errors > 5%
- Response time > 5 seconds

---

## Next Steps After Summit

1. **Full implementation of Alexei's approach**
   - Complete Quilt3 → GraphQL/REST migration
   - Optimize token handling
   - Add comprehensive error handling

2. **Benchling MCP integration**
   - Apply same stateless auth pattern
   - Stack-wide vs user-specific credentials decision
   - OAuth flow for Benchling tokens

3. **Tabulator MCP tools**
   - Non-admin endpoint creation
   - Permission handling
   - Integration with MCP server

4. **Production hardening**
   - Load testing
   - Security penetration testing
   - Documentation completion
   - Monitoring dashboards

---

## Questions to Answer Before Deployment

### Architecture
- [ ] Are we committed to Alexei's approach?
- [ ] Do we understand the security implications?
- [ ] Is the timeline realistic?

### Implementation
- [ ] Do we have all the GraphQL/REST endpoints we need?
- [ ] Can the backend validate catalog tokens?
- [ ] Do we know how to extract permissions from tokens?

### Testing
- [ ] Do we have a test environment?
- [ ] Can we test with multiple users?
- [ ] Do we have rollback tested?

### Security
- [ ] Has Alexei reviewed the approach?
- [ ] Do we pass security guidelines?
- [ ] Are secrets properly managed?

---

## Summary Recommendation

### For October 15 Summit Demo

**DO THIS:**
1. ✅ Remove JWT signing from frontend immediately
2. ✅ Use existing catalog token from Redux
3. ✅ Backend accepts and forwards token to registry
4. ✅ Minimal but secure implementation
5. ✅ Get Alexei's code review before deploying

**DON'T DO THIS:**
1. ❌ Keep enhanced JWT generation in browser
2. ❌ Store secrets in frontend config
3. ❌ Use complex token enhancement flow
4. ❌ Deploy without security review
5. ❌ Assume current approach is production-ready

### Timeline Estimate

- **Security fixes:** 4-8 hours
- **Frontend simplification:** 8-16 hours  
- **Backend refactoring:** 16-24 hours
- **Testing:** 8-16 hours
- **Total:** 2-3 days of focused work

---

## Action Items for Right Now

1. **STOP** - Don't deploy current implementation as-is
2. **REVIEW** - Read both new specs thoroughly
3. **DECIDE** - Choose approach with team
4. **AUDIT** - Check for secrets in frontend
5. **PLAN** - Timeline to Summit (14 days)
6. **CONSULT** - Get Alexei's review before proceeding

---

## Contact for Questions

- **Architecture:** Alexei Mochalov (nl_0@quiltdata.io)
- **Security:** [Add security contact]
- **Deployment:** [Add DevOps contact]

---

**Status:** 🔴 NOT READY FOR DEPLOYMENT - Security Issues Present  
**Blocker:** JWT secrets in frontend code must be removed  
**Next Step:** Remove secrets and implement Alexei's recommended approach


