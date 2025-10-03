# Dynamic Context Limits Deployment - October 3, 2025

## Issue Resolved

The context meter was showing "Model: Unknown" and using a hardcoded 200K context limit, regardless of which model was selected in Settings. This meant users couldn't see the actual context limit for their chosen model.

## Solution Implemented

### 1. **Dynamic Model Detection**
- Added logic to read the selected model from `window.__modelIdOverride`
- Fallback to default Claude Sonnet 4.5 model if no override is set
- Model selection is now reactive to Settings changes

### 2. **Comprehensive Context Limits Database**
Updated `TokenCounter.ts` with accurate context limits for all supported models:

**Claude Models:**
- Claude Sonnet 4.5: 200K tokens
- Claude 3.5 Sonnet: 200K tokens  
- Claude 3 Opus/Sonnet/Haiku: 200K tokens
- Claude Instant: 100K tokens

**Amazon Nova Models:**
- Nova Pro: 200K tokens
- Nova Lite: 200K tokens
- Nova Micro: 128K tokens

**Mistral Models:**
- Mistral Large: 32K tokens
- Mixtral 8x7B: 32K tokens
- Mistral 7B: 32K tokens

**Other Models:**
- Llama 3.1 70B: 128K tokens
- Llama 3.1 8B: 128K tokens
- Llama 3 70B/8B: 8K tokens
- AI21 Jamba: 256K tokens
- Cohere Command R+: 128K tokens

### 3. **Enhanced Context Meter Display**
- Shows actual model name instead of "Unknown"
- Displays correct context limit for selected model
- Model name is simplified (e.g., "claude-sonnet-4-5" instead of full ID)
- Context calculations use the correct limit

### 4. **Updated Interface**
- Added `modelName?: string` to `CumulativeUsage` interface
- Context meter tooltip now shows:
  - **Model:** [actual model name]
  - **Context limit:** [correct limit for model]
  - **Used:** [tokens and percentage]
  - **Input/Output:** [breakdown]
  - **Remaining:** [tokens left]

## Technical Changes

### Files Modified:
1. **`TokenCounter.ts`**
   - Added `modelName` to `CumulativeUsage` interface
   - Updated Nova model limits to correct 200K values
   - Comprehensive model context limits database

2. **`Chat.tsx`**
   - Added `getContextLimit` import
   - Dynamic model selection from settings
   - Context usage calculation uses correct model limit
   - Passes model name to context meter

3. **`ContextMeter.tsx`**
   - Displays actual model name in tooltip
   - Simplified model name display (removes path/version)
   - Shows correct context limit for selected model

## Deployment Details

**Deployment Time:** October 3, 2025 ~09:15 CDT  
**Task Definition:** sales-prod-nginx_catalog:137  
**ECR Image:** 850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:latest  
**Image Digest:** sha256:14651f36adeac3e2e7bc1df55659bb58dde649cc7f42328e0532730dc0708067

## What Users Will See Now

### Before:
- Model: Unknown
- Context limit: 200.0K (hardcoded)
- Same limit regardless of model selection

### After:
- Model: claude-sonnet-4-5 (or actual selected model)
- Context limit: 200.0K (or correct limit for model)
- Different limits for different models:
  - Mistral models: 32.0K
  - Nova models: 200.0K  
  - Claude models: 200.0K
  - Llama 3: 8.0K
  - Llama 3.1: 128.0K

## Testing Instructions

1. **Open Settings** (gear icon)
2. **Change Model** to a different one (e.g., Mistral)
3. **Check Context Meter** - should show:
   - Correct model name
   - Correct context limit (32K for Mistral)
4. **Start Conversation** - percentage should be calculated against correct limit
5. **Switch Models** - context meter should update automatically

## Benefits

- **Accurate Context Tracking:** Users see real limits for their chosen model
- **Better Planning:** Users can plan conversations based on actual model capabilities  
- **Model Comparison:** Easy to see how different models compare in context capacity
- **No More Confusion:** No more "Unknown" model or wrong limits

## Commits

- `962e38b9` - "feat: Dynamic context limits based on selected model"

## Rollback Plan

If issues arise:

```bash
aws ecs update-service --cluster sales-prod --service sales-prod-nginx_catalog \
  --task-definition sales-prod-nginx_catalog:136 --region us-east-1
```

## Notes

- Context limits are based on official model documentation
- Nova models corrected from 300K to 200K (actual limit)
- Model name display is simplified for better UX
- All calculations now use correct model-specific limits
- Settings changes are immediately reflected in context meter
