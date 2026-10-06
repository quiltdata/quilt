import * as JSONPointer from 'utils/JSONPointer'
import type { JsonRecord } from 'utils/types'

// S3 object tag limits:
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-tagging.html
export const MAX_TAGS = 10
const MAX_KEY_LENGTH = 128
const MAX_VALUE_LENGTH = 256
// Letters, digits and spaces in any script, plus `_ . : / = + - @`
const ALLOWED_CHARS = new RegExp('^[\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]*$', 'u')

/** Tag key -> JSON pointer into package `user_meta` */
export interface S3TagsConfig {
  tags: Record<string, JSONPointer.Pointer>
}

export function parseConfig(input: unknown): S3TagsConfig {
  const tags = (input as { tags?: unknown } | null)?.tags
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
    throw new Error('s3_tags config must have a `tags` map of tag key to JSON pointer')
  }
  Object.entries(tags).forEach(([key, pointer]) => {
    if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
      throw new Error(`s3_tags: tag "${key}" must map to a JSON pointer like "/field"`)
    }
    const error = validateKey(key)
    if (error) throw new Error(`s3_tags: ${error}`)
  })
  return { tags: tags as Record<string, string> }
}

function validateKey(key: string): string | null {
  if (!key || key.length > MAX_KEY_LENGTH) return `key "${key}" must be 1-128 characters`
  if (key.toLowerCase().startsWith('aws:'))
    return `key "${key}" uses reserved prefix aws:`
  if (!ALLOWED_CHARS.test(key)) return `key "${key}" has characters S3 tags don't allow`
  return null
}

export interface ProjectedTag {
  key: string
  pointer: string
  value?: string
  error?: string
}

/** Values the metadata projects onto tags; a missing or null value removes the tag. */
export function project(config: S3TagsConfig, meta: JsonRecord | undefined) {
  return Object.entries(config.tags).map(([key, pointer]): ProjectedTag => {
    const raw = meta ? JSONPointer.getValue(meta, pointer) : undefined
    if (raw === undefined || raw === null) return { key, pointer }
    if (typeof raw === 'object') {
      return { key, pointer, error: 'Only strings, numbers and booleans become tags' }
    }
    const value = String(raw)
    if (value.length > MAX_VALUE_LENGTH) {
      return { key, pointer, value, error: 'Longer than 256 characters' }
    }
    if (!ALLOWED_CHARS.test(value)) {
      return { key, pointer, value, error: "Has characters S3 tags don't allow" }
    }
    return { key, pointer, value }
  })
}

/**
 * `PutObjectTagging` replaces the whole set, so tags the config doesn't own are carried over,
 * and an owned tag stays as is when the new value can't be a tag.
 */
export function merge(
  config: S3TagsConfig,
  projected: ProjectedTag[],
  existing: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = {}
  const owned = (k: string) => Object.prototype.hasOwnProperty.call(config.tags, k)
  Object.entries(existing).forEach(([k, v]) => {
    if (!owned(k)) merged[k] = v
  })
  projected.forEach(({ key, value, error }) => {
    if (error) {
      if (key in existing) merged[key] = existing[key]
    } else if (value !== undefined) {
      merged[key] = value
    }
  })
  return merged
}
