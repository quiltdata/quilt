# 🚨 JWT Secret Mismatch - Complete Diagnostic & Fix

## ✅ Backend Configuration Verified

The backend configuration is **CORRECT**:
- ✅ SSM Parameter Store: `/quilt/mcp-server/jwt-secret`
- ✅ Value: `QuiltMCPJWTSecret2025ProductionV1` (33 chars)
- ✅ Last Updated: September 30, 2025 @ 09:48 AM
- ✅ Version: 6

The frontend configuration is **CORRECT** in ECS:
- ✅ Environment variable loaded from SSM
- ✅ Task definition references correct SSM parameter
- ✅ Containers restarted at 11:24 AM (after SSM update)

## 🔍 Why Is It Still Broken?

The containers have the correct configuration from SSM, but there may be:
1. **Browser caching** the old config.js file
2. **JavaScript caching** the old secret in memory
3. **Token generator** initialized with old secret before page refresh

---

## 🚀 IMMEDIATE FIX (Run in Browser Console)

### Option 1: Run Diagnostic Script (Recommended)

**Copy and paste this entire script into your browser console:**

```javascript
// Paste contents of JWT_DIAGNOSTIC_SCRIPT.js here
// This will show you exactly what's wrong
```

Or load it directly:
```javascript
// Load and run diagnostic
fetch('/JWT_DIAGNOSTIC_SCRIPT.js')
  .then(r => r.text())
  .then(eval)
```

### Option 2: Emergency Fix Script

**If diagnostic shows the secret is wrong, run this:**

```javascript
// Paste contents of JWT_EMERGENCY_FIX_SCRIPT.js here
// This will force-update the secret and regenerate tokens
```

### Option 3: Manual Quick Fix

**Run these commands one by one in browser console:**

```javascript
// 1. Check current secret
console.log('Config Secret:', window.QUILT_CATALOG_CONFIG?.mcpEnhancedJwtSecret)
console.log('Secret Length:', window.QUILT_CATALOG_CONFIG?.mcpEnhancedJwtSecret?.length)

// 2. Check token generator
const tokenGen = window.__dynamicAuthManager?.tokenGenerator
console.log('TokenGen Secret:', tokenGen?.signingSecret)
console.log('TokenGen Length:', tokenGen?.signingSecret?.length)

// 3. If secret is wrong (not 33 chars), force-update it
if (tokenGen?.signingSecret !== 'QuiltMCPJWTSecret2025ProductionV1') {
  console.log('🔧 FIXING: Updating token generator secret...')
  tokenGen.signingSecret = 'QuiltMCPJWTSecret2025ProductionV1'
  tokenGen.signingKeyId = 'frontend-enhanced'
  console.log('✅ Updated!')
}

// 4. Clear all caches
localStorage.clear()
window.__dynamicAuthManager.clearCache()
console.log('✅ Caches cleared')

// 5. Generate fresh token
const newToken = await window.__dynamicAuthManager.refreshToken()
console.log('✅ New token generated:', newToken.length, 'chars')

// 6. Decode and verify
const payload = JSON.parse(atob(newToken.split('.')[1]))
const age = Math.floor(Date.now() / 1000) - payload.iat
console.log('Token age:', age, 'seconds (should be < 10)')

// 7. Test MCP call
try {
  const result = await window.__mcpClient.callTool({
    name: 'bucket_objects_list',
    arguments: { bucket: 's3://quilt-sandbox-bucket', max_keys: 1 }
  })
  console.log('🎉 SUCCESS! MCP tools working!')
} catch (e) {
  console.error('❌ Still failing:', e.message)
  console.log('Try hard refresh: Cmd+Shift+R')
}
```

---

## 🔄 Alternative: Hard Browser Refresh

Sometimes the simplest solution works best:

**1. Hard Refresh (Clears ALL browser caches)**:
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`
- **Safari**: `Cmd + Option + R`

**2. Or use Incognito/Private Mode**:
- This ensures no cached config/tokens

**3. Or Clear Site Data**:
- F12 → Application → Storage → Clear Site Data

---

## 🧪 After Fix - Verification Commands

Run these in console after the fix to verify:

```javascript
// Should show 33 chars
console.log('Secret Length:', window.QUILT_CATALOG_CONFIG.mcpEnhancedJwtSecret?.length)

// Should show 33 chars
console.log('TokenGen Length:', window.__dynamicAuthManager.tokenGenerator.signingSecret?.length)

// Should be < 10 seconds
const token = await window.__dynamicAuthManager.getCurrentToken()
const payload = JSON.parse(atob(token.split('.')[1]))
const age = Math.floor(Date.now() / 1000) - payload.iat
console.log('Token age:', age, 'seconds')

// Should succeed without errors
const result = await window.__mcpClient.callTool({
  name: 'bucket_objects_list',
  arguments: { bucket: 's3://quilt-sandbox-bucket' }
})
console.log('MCP Success:', !!result)
```

**Expected Results:**
- ✅ Secret Length: 33
- ✅ TokenGen Length: 33
- ✅ Token age: < 10 seconds
- ✅ MCP Success: true

---

## 🎯 Root Cause

The issue is likely one of these:

### Most Likely: Browser Cache
- Browser cached the old `config.js` file
- Hard refresh forces reload from server
- **Solution**: Hard refresh (`Cmd+Shift+R`)

### Also Possible: JavaScript Memory Cache
- Token generator initialized with old secret
- Stays in memory until page reload
- **Solution**: Force update via emergency script

### Less Likely: SSM Not Loading
- Container didn't load from SSM properly
- **Solution**: Container restart (already triggered)

---

## 📊 Current Deployment Status

- ✅ **New deployment triggered**: `ecs-svc/8780431618068714567`
- ✅ **Status**: PRIMARY (rolling out now)
- ✅ **Tasks**: Will be 2/2 when complete
- ✅ **SSM Parameter**: Correct value (`QuiltMCPJWTSecret2025ProductionV1`)
- ✅ **Task Definition**: Configured to load from SSM

**Wait Time**: 2-3 minutes for new containers to be fully healthy

---

## 🔧 Step-by-Step Fix Procedure

### Step 1: Wait for Deployment (2-3 minutes)
The new deployment is rolling out with fresh containers that will load the correct secret from SSM.

### Step 2: Hard Refresh Browser
Once deployment completes:
1. Open your demo site
2. Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
3. This forces browser to reload config.js from server

### Step 3: Run Diagnostic
Open console (F12) and run:
```javascript
console.log('Secret:', window.QUILT_CATALOG_CONFIG.mcpEnhancedJwtSecret)
console.log('Length:', window.QUILT_CATALOG_CONFIG.mcpEnhancedJwtSecret?.length)
// Expected: QuiltMCPJWTSecret2025ProductionV1 (33 chars)
```

### Step 4: Test MCP
```javascript
const result = await window.__mcpClient.callTool({
  name: 'bucket_objects_list',
  arguments: { bucket: 's3://quilt-sandbox-bucket', max_keys: 1 }
})
console.log('Success:', !!result)
// Expected: true
```

### Step 5: If Still Broken
Run the emergency fix script (see Option 2 above)

---

## 🆘 Emergency Fallback

If nothing works, you can temporarily use the backend's IAM role instead of JWT:

```javascript
// Disable JWT enhancement temporarily
window.__dynamicAuthManager.updateConfig({
  enableTokenEnhancement: false,
  autoRefreshOnError: false
})

// MCP will fall back to IAM role headers
```

**Note**: This should only be a temporary workaround while investigating!

---

## 📞 Next Steps

1. **Wait 2-3 minutes** for deployment to complete
2. **Hard refresh** browser (`Cmd+Shift+R`)
3. **Run diagnostic script** to verify configuration
4. **Test MCP tools** to confirm working
5. **If still broken**, run emergency fix script

---

**Status**: 🔄 Deployment in progress (ETA: 2-3 minutes)  
**Action Required**: Hard refresh browser after deployment completes  
**Expected Result**: JWT authentication fully working with 33-char secret







