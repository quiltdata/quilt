# 🔧 Deployment Fix Summary - Version 1.64.1a7

## Problem Identified

The deployment was **NOT** using the new Docker image because:

1. **Task Definition Used Hardcoded SHA256 Digest**: The task definition referenced a specific image digest instead of a tag:
   - **OLD**: `@sha256:70ffb8197f908aa7d96d2daf13e12b94d7b93fa49aa57a1741406fbf78ef290d`
   - This digest pointed to an old image (`thinking-dots-runtime-context`)

2. **Force New Deployment Without New Task Definition**: The initial deployment forced a new deployment but didn't update the task definition, so it just restarted the same old image

## Solution Applied

1. **Retrieved New Image Digest**:
   ```bash
   sha256:eb704e794c8291063b0cda3e4b4c8c223b914ed7856713a177db536ba559225b
   ```

2. **Updated Task Definition** (`updated-task-definition-correct-mcp.json`):
   - Changed image reference to new digest
   - Set `STACK_VERSION` environment variable to `1.64.1a7`

3. **Registered New Task Definition**:
   - Created revision **95** of `sales-prod-nginx_catalog`

4. **Updated Service with New Task Definition**:
   - Explicitly specified task definition revision 95
   - Forced new deployment with correct image

## Current Deployment Status

✅ **Successfully Deployed**

- **Service**: `sales-prod-nginx_catalog`
- **Cluster**: `sales-prod`
- **Task Definition**: `sales-prod-nginx_catalog:95`
- **Image**: `850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog@sha256:eb704e794c8291063b0cda3e4b4c8c223b914ed7856713a177db536ba559225b`
- **Running Tasks**: 2/2 healthy
- **Started At**: 2025-09-30 19:41:13 UTC

## What Changed in This Image

1. **MCP Client Fix** (`Client.ts`):
   - `sendInitializedNotification()` now **requires** a bearer token
   - Implements retry logic (3 attempts) to acquire token
   - **Aborts** the notification if no token available
   - Prevents sending `notifications/initialized` without Authorization header

2. **Version Indicator**:
   - Footer now displays: **"Version: 1.64.1a7"**
   - Allows visual confirmation of deployment

## Verification Steps

1. **Hard Refresh Browser**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
2. **Check Footer**: Should show "Version: 1.64.1a7"
3. **Check Browser Console**:
   - Look for: `"🔄 notifications/initialized attempt 1: acquiring bearer token"`
   - Verify Authorization header is present
   - The error should be resolved

## Why Previous Deployment Failed

The ECS service was configured to use a **digest-pinned image**, which means:
- Even when we pushed a new `:latest` tag, ECS kept using the old digest
- The `force-new-deployment` flag just restarted existing tasks with the same image
- We needed to update the task definition with the **new digest** for the change to take effect

## Key Takeaway

**Always verify the image digest when deploying to ECS with digest-pinned task definitions.**




