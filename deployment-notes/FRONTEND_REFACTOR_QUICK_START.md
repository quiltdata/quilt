# Frontend Refactor Quick Start

**Estimated Time:** 4-5 hours  
**Status:** Ready to execute  
**Backend:** ✅ Already refactored

---

## Pre-Flight Checklist

Before you start:

- [ ] **Backup current code**
  ```bash
  cd /Users/simonkohnstamm/Documents/Quilt/quilt
  git checkout -b frontend-auth-refactor
  git add -A
  git commit -m "Backup before frontend auth refactor"
  ```

- [ ] **Read the implementation guide**
  - Open `FRONTEND_AUTH_REFACTOR_IMPLEMENTATION_GUIDE.md`
  - Understand the phases
  - Have it open for reference

- [ ] **Verify backend is ready**
  - Backend accepts catalog tokens in Authorization header
  - Backend validates tokens with registry
  - Backend is stateless (no Quilt3)

---

## Execute Refactor (Copy-Paste Friendly)

### Step 1: Delete Old Files (2 minutes)

```bash
cd /Users/simonkohnstamm/Documents/Quilt/quilt/catalog/app/services

# Delete enhanced token generator
rm -f EnhancedTokenGenerator.js

# Delete JWT utilities
rm -f jwt-decompression-utils.js
rm -f JWTCompressionFormat.md
rm -f MCP_Server_JWT_Decompression_Guide.md
rm -f test-jwt-decompression.js
rm -f JWTValidator.js

# Verify deletion
ls -la | grep -E "(Enhanced|jwt-|JWT)"
# Should return nothing
```

### Step 2: Verify What Needs Updating

```bash
cd /Users/simonkohnstamm/Documents/Quilt/quilt/catalog/app

# Find files that import deleted services
grep -r "EnhancedTokenGenerator" . --exclude-dir=node_modules
grep -r "JWTValidator" . --exclude-dir=node_modules
grep -r "jwt-decompression" . --exclude-dir=node_modules

# Find files that reference mcpEnhancedJwtSecret
grep -r "mcpEnhancedJwtSecret" . --exclude-dir=node_modules
```

### Step 3: Create Simplified DynamicAuthManager

Open `catalog/app/services/DynamicAuthManager.js` and replace **entire contents** with the simplified version from the implementation guide.

**Quick way:**
```bash
# I'll provide the file - paste the simplified version from 
# FRONTEND_AUTH_REFACTOR_IMPLEMENTATION_GUIDE.md Phase 2
```

### Step 4: Update MCP Client

Open `catalog/app/components/Assistant/MCP/Client.ts` and update the token acquisition methods with the simplified version from Phase 3.

### Step 5: Update MCP Context Provider

Open `catalog/app/components/Assistant/MCP/MCPContextProvider.tsx` and simplify according to Phase 4.

### Step 6: Remove Config Secrets

Edit `catalog/config.json.tmpl`:
```bash
# Remove these lines:
- "mcpEnhancedJwtSecret": "${mcp_enhanced_jwt_secret}",
- "mcpEnhancedJwtKid": "frontend-enhanced",
```

### Step 7: Test Locally

```bash
cd /Users/simonkohnstamm/Documents/Quilt/quilt/catalog

# Install dependencies (if needed)
npm install

# Build
npm run build

# Start dev server
npm start
```

Then in browser console:
```javascript
// Quick test
window.__dynamicAuthManager?.getCurrentToken().then(token => {
  console.log('Token:', token ? '✅ Retrieved' : '❌ Failed')
  console.log('Length:', token?.length)
})
```

---

## Validation Checklist

After each phase, verify:

### After File Deletion
- [ ] Files deleted successfully
- [ ] No errors when running `npm install`

### After DynamicAuthManager Update
- [ ] File compiles without errors
- [ ] TypeScript definitions updated

### After MCP Client Update
- [ ] File compiles without errors
- [ ] No import errors

### After MCP Context Provider Update
- [ ] File compiles without errors
- [ ] React components load

### After Config Update
- [ ] Config file is valid JSON
- [ ] No secret references remain

### After Build
- [ ] Build succeeds
- [ ] No webpack errors
- [ ] Bundle size reasonable

---

## Test in Browser

1. **Start the catalog:**
   ```bash
   cd catalog && npm start
   ```

2. **Open browser to http://localhost:3000**

3. **Open DevTools Console**

4. **Run test script:**
   ```javascript
   (async () => {
     console.log('🧪 Quick Test')
     const mgr = window.__dynamicAuthManager
     if (!mgr) return console.error('❌ No auth manager')
     const token = await mgr.getCurrentToken()
     console.log(token ? '✅ Token: ' + token.substring(0,50) : '❌ No token')
   })()
   ```

5. **Check Network Tab:**
   - Make an MCP request
   - Verify `Authorization: Bearer ...` header present
   - Verify token is the catalog token

---

## If Something Breaks

### Quick Rollback
```bash
cd /Users/simonkohnstamm/Documents/Quilt/quilt
git reset --hard HEAD
git clean -fd
npm install
npm run build
```

### Debug Mode
```javascript
// In browser console
window.__dynamicAuthManager?.getDebugInfo()
```

### Check Redux State
```javascript
// In browser console - find where token is stored
const state = window.__REDUX_STORE__?.getState()
console.log('State:', state)

// Look for auth/token locations
JSON.stringify(state, null, 2)
```

---

## Common Issues

### Issue: "Cannot find module 'EnhancedTokenGenerator'"
**Solution:** Remove import statement from the file showing the error

### Issue: "mcpEnhancedJwtSecret is not defined"
**Solution:** Remove reference from config and rebuild

### Issue: "Token is null"
**Solution:** 
1. Check if logged in to catalog
2. Check Redux state for token
3. Update `findTokenInState()` method in DynamicAuthManager

### Issue: "MCP request fails with 401"
**Solution:**
1. Verify backend is running
2. Check backend logs for token validation
3. Verify backend expects catalog token format

---

## Time Estimate Breakdown

| Task | Time | Running Total |
|------|------|---------------|
| Setup & backup | 10 min | 10 min |
| Delete files | 5 min | 15 min |
| DynamicAuthManager | 45 min | 60 min |
| MCP Client | 45 min | 105 min |
| Context Provider | 30 min | 135 min |
| Config updates | 15 min | 150 min |
| Build & fix errors | 30 min | 180 min |
| Testing | 45 min | 225 min |
| **TOTAL** | **~4 hours** | |

---

## Success = All Green

- ✅ No JWT signing in browser
- ✅ No secrets in config
- ✅ Token retrieved from Redux
- ✅ MCP requests work
- ✅ Backend receives catalog token
- ✅ No console errors
- ✅ Build succeeds

---

## Ready? Let's Go!

1. **Run the backup command** (above)
2. **Start with Step 1** (delete files)
3. **Work through each step** systematically
4. **Test after each phase**
5. **Commit when all green**

**Commit message when done:**
```bash
git add -A
git commit -m "Refactor: Simplify auth to use catalog token (Alexei's approach)

- Remove JWT signing from browser
- Remove EnhancedTokenGenerator and related services
- Simplify DynamicAuthManager to just get catalog token from Redux
- Update MCP client to use catalog token directly
- Remove mcpEnhancedJwtSecret from config
- Backend now validates catalog tokens with registry

Refs: FRONTEND_AUTH_REFACTOR_IMPLEMENTATION_GUIDE.md"
```

---

**Questions while working? Check the implementation guide or ping me!**


