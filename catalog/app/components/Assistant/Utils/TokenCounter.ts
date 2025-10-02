/**
 * Token Counter Utility for Qurator
 *
 * Tracks token usage across conversation to prevent context window overruns.
 * Provides utilities for counting tokens and managing context limits.
 */

// Model context limits (in tokens)
export const CONTEXT_LIMITS = {
  // Claude 4.5 (Sonnet) - Extended context
  'global.anthropic.claude-sonnet-4-5-20250929-v1:0': 200_000,

  // Claude 3.7 (Sonnet)
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0': 200_000,

  // Claude 3.5 (Sonnet)
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': 200_000,
  'anthropic.claude-3-5-sonnet-20240620-v1:0': 200_000,

  // Claude 3 (Sonnet, Opus, Haiku)
  'anthropic.claude-3-sonnet-20240229-v1:0': 200_000,
  'anthropic.claude-3-opus-20240229-v1:0': 200_000,
  'anthropic.claude-3-haiku-20240307-v1:0': 200_000,

  // Amazon Nova Models
  'us.amazon.nova-pro-v1:0': 300_000,
  'us.amazon.nova-lite-v1:0': 300_000,
  'us.amazon.nova-micro-v1:0': 128_000,

  // Meta Llama Models
  'meta.llama3-70b-instruct-v1:0': 8_000,
  'meta.llama3-8b-instruct-v1:0': 8_000,
  'meta.llama3-1-70b-instruct-v1:0': 128_000,
  'meta.llama3-1-8b-instruct-v1:0': 128_000,

  // Mistral Models
  'mistral.mistral-large-2402-v1:0': 32_000,
  'mistral.mixtral-8x7b-instruct-v0:1': 32_000,
  'mistral.mistral-7b-instruct-v0:2': 32_000,

  // AI21 Models
  'ai21.jamba-instruct-v1:0': 256_000,

  // Cohere Models
  'cohere.command-r-plus-v1:0': 128_000,
  'cohere.command-r-v1:0': 128_000,

  // Default for unknown models
  default: 200_000,
} as const

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface CumulativeUsage extends TokenUsage {
  percentUsed: number
  tokensRemaining: number
  contextLimit: number
  isNearLimit: boolean // >80%
  isCritical: boolean // >95%
}

/**
 * Get context limit for a specific model
 */
export function getContextLimit(modelId: string): number {
  return CONTEXT_LIMITS[modelId as keyof typeof CONTEXT_LIMITS] || CONTEXT_LIMITS.default
}

/**
 * Rough token estimation (for preview purposes)
 * Real tokens come from Bedrock API responses
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  // This is just for estimation when actual token count isn't available
  return Math.ceil(text.length / 4)
}

/**
 * Calculate cumulative usage statistics
 * Uses sliding window approach to account for model context truncation
 */
export function calculateCumulativeUsage(
  usageHistory: TokenUsage[],
  modelId: string,
): CumulativeUsage {
  const contextLimit = getContextLimit(modelId)

  // Use sliding window approach - only count recent tokens that fit in context window
  // This accounts for automatic context truncation by models
  let windowTokens = 0
  let windowInputTokens = 0
  let windowOutputTokens = 0

  // Work backwards from most recent tokens until we hit the context limit
  for (let i = usageHistory.length - 1; i >= 0; i--) {
    const usage = usageHistory[i]
    const wouldExceed = windowTokens + usage.totalTokens > contextLimit

    if (wouldExceed) {
      // If adding this usage would exceed the limit, only add what fits
      const remainingCapacity = contextLimit - windowTokens
      const inputRatio = usage.inputTokens / usage.totalTokens
      const outputRatio = usage.outputTokens / usage.totalTokens

      windowTokens = contextLimit
      windowInputTokens += remainingCapacity * inputRatio
      windowOutputTokens += remainingCapacity * outputRatio
      break
    } else {
      windowTokens += usage.totalTokens
      windowInputTokens += usage.inputTokens
      windowOutputTokens += usage.outputTokens
    }
  }

  // If we have no history, use the most recent usage if available
  if (windowTokens === 0 && usageHistory.length > 0) {
    const latest = usageHistory[usageHistory.length - 1]
    windowTokens = Math.min(latest.totalTokens, contextLimit)
    windowInputTokens = Math.min(latest.inputTokens, contextLimit * 0.8) // Assume 80% input
    windowOutputTokens = Math.min(latest.outputTokens, contextLimit * 0.2) // Assume 20% output
  }

  const percentUsed = (windowTokens / contextLimit) * 100
  const tokensRemaining = Math.max(0, contextLimit - windowTokens)

  return {
    inputTokens: Math.round(windowInputTokens),
    outputTokens: Math.round(windowOutputTokens),
    totalTokens: Math.round(windowTokens),
    percentUsed: Math.min(percentUsed, 100), // Cap at 100%
    tokensRemaining,
    contextLimit,
    isNearLimit: percentUsed > 80,
    isCritical: percentUsed > 95,
  }
}

/**
 * Extract token usage from Bedrock response
 */
export function extractBedrockUsage(backendResponse: any): TokenUsage | null {
  if (!backendResponse?.usage) {
    return null
  }

  const { inputTokens, outputTokens, totalTokens } = backendResponse.usage

  return {
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    totalTokens: totalTokens || inputTokens + outputTokens || 0,
  }
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

/**
 * Get warning level based on usage percentage
 */
export function getWarningLevel(percentUsed: number): 'safe' | 'warning' | 'critical' {
  if (percentUsed > 95) return 'critical'
  if (percentUsed > 80) return 'warning'
  return 'safe'
}
