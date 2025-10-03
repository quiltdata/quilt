# 🎯 JWT Automatic Refresh - User Guide

> **Note**: This guide describes the legacy automatic JWT refresh feature.
> Frontend token minting has been removed and the catalog now reuses its
> existing authentication token for MCP calls.

## What Is This?

The **automatic JWT refresh** feature handles authentication token updates seamlessly when the backend security configuration changes. **You don't need to do anything manually** - the system handles everything automatically!

## What Happens Automatically

### When Backend JWT Secret Changes:

1. ✅ **Automatic Detection**: System detects JWT validation errors
2. ✅ **Automatic Refresh**: Token is regenerated with new secret
3. ✅ **Automatic Retry**: Failed operations are retried automatically
4. ℹ️ **User Notification**: You see a notification explaining what happened

**Result**: Everything works seamlessly with zero downtime!

## What You'll See

### Success Case (Most Common):

You won't see anything! The system handles token refresh automatically in the background.

```
Your Request → JWT Error Detected → Token Auto-Refreshed → Request Succeeds ✅
```

### If Automatic Refresh Needs Your Attention:

You'll see a friendly notification like this:

```
⚠️ Authentication Token Issue Detected

Your authentication token may be using an outdated JWT secret.

[Refresh Token]  [Hard Refresh Page]  [Dismiss]

More Information ▼
```

## What To Do

### Option 1: Let It Handle Automatically (Recommended)
**Do nothing** - The system already tried to refresh automatically. If you see the notification, it means a rare edge case occurred.

### Option 2: Click "Refresh Token"
Manually triggers token regeneration. Use this if:
- The notification appears
- Automatic refresh didn't work
- You want to force a fresh token

### Option 3: Click "Hard Refresh Page"
Completely reloads the page, clearing all caches. Use this if:
- Token refresh doesn't work
- You see persistent errors
- You want to start completely fresh

### Option 4: Dismiss
Hides the notification. The system will continue to auto-refresh on subsequent requests.

## Keyboard Shortcuts

If notification doesn't appear, you can force a hard refresh:
- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`
- **Safari**: `Cmd + Option + R`

## Developer Tools

### Check Token Status:
```javascript
// Open browser console (F12)

// Get current token info
const token = await window.__dynamicAuthManager.getCurrentToken()
console.log('Token length:', token?.length)

// Check validation stats
const stats = window.__dynamicAuthManager.getJWTValidationStats()
console.log('Validation errors:', stats.validationFailureCount)

// Validate current token
const validation = await window.__dynamicAuthManager.ensureValidToken()
console.log('Token valid:', validation.valid)
```

### Force Token Refresh:
```javascript
// Clear cache and refresh
await window.__dynamicAuthManager.clearCache()
const newToken = await window.__dynamicAuthManager.refreshToken()
console.log('New token generated:', !!newToken)
```

### Check Configuration:
```javascript
// Verify JWT secret is configured correctly
const config = window.QUILT_CATALOG_CONFIG
console.log('JWT Secret Length:', config.mcpEnhancedJwtSecret?.length)
console.log('JWT Key ID:', config.mcpEnhancedJwtKid)
console.log('Expected Secret:', 'QuiltMCPJWTSecret2025ProductionV1')
console.log('Secret Matches:', config.mcpEnhancedJwtSecret === 'QuiltMCPJWTSecret2025ProductionV1')
```

## Troubleshooting

### ❓ I see "JWT verification failed" errors

**Solution**: The system should auto-refresh. If errors persist:
1. Click "Refresh Token" in the notification
2. If that doesn't work, click "Hard Refresh Page"
3. If still failing, clear browser cache completely

### ❓ Notification keeps appearing

**Solution**: This may indicate a configuration mismatch:
1. Check browser console for detailed error messages
2. Verify backend and frontend are using the same JWT secret
3. Contact your admin team with the error details

### ❓ MCP tools not working

**Solution**: 
1. Check if notification is showing - click "Refresh Token"
2. Check browser console for errors
3. Verify MCP endpoint is configured correctly
4. Try hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### ❓ Want to disable automatic refresh (not recommended)

**Solution**:
```javascript
// In browser console
window.__dynamicAuthManager.updateConfig({
  autoRefreshOnError: false
})
```

**Warning**: You'll need to manually refresh the page when JWT secrets change!

## FAQ

### Q: Do I need to do anything when the JWT secret is updated?
**A**: No! The system handles it automatically.

### Q: Will my work be lost during token refresh?
**A**: No! Token refresh happens in the background without interrupting your session.

### Q: How often does this happen?
**A**: Only when the backend security configuration is updated (rare - typically during security rotations).

### Q: What if automatic refresh fails?
**A**: You'll see a notification with options to manually refresh. The notification has detailed instructions.

### Q: Can I monitor token refresh activity?
**A**: Yes! Open browser console and check for messages with "🔄" or "JWT" in them.

## Expected Behavior

| Scenario | What Happens | What You See |
|----------|--------------|--------------|
| **Normal Operation** | Tokens work fine | Nothing - seamless operation |
| **Backend Secret Updated** | Auto-refresh on first error | Brief notification, then works |
| **Auto-refresh Succeeds** | System continues normally | Success message, auto-dismisses |
| **Auto-refresh Fails** | Notification with options | Notification with refresh buttons |
| **Hard Refresh Needed** | Manual page reload required | Notification prompts for hard refresh |

## Support

If you encounter issues:

1. **Check browser console** (F12) for detailed error messages
2. **Try the notification buttons** - they're designed to fix common issues
3. **Note the error message** and share with support team
4. **Include these details**:
   - What you were trying to do
   - Error message from console
   - Screenshot of notification (if shown)

## Summary

✅ **Automatic**: System handles JWT refresh without user intervention  
✅ **Transparent**: Clear notifications when user attention is needed  
✅ **Reliable**: Multiple fallback options if automatic refresh fails  
✅ **Zero Downtime**: No interruption to your work  

**You can focus on your work - we handle the authentication!** 🚀






