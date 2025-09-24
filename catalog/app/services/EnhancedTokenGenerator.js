/**
 * EnhancedTokenGenerator
 *
 * Generates front-end enhanced JWTs with comprehensive authorization claims.
 */

import cfg from 'constants/config'

import {
  AuthorizationLevel,
  buildCapabilities,
  mergeAuthorizationForRoles,
  resolveRoleName,
} from './mcpAuthorization'

import { decodeJwt, signJwt } from 'components/Assistant/MCP/decode-token'

const DEFAULT_REGION = 'us-east-1'

const levelPriority = {
  [AuthorizationLevel.READ]: 0,
  [AuthorizationLevel.WRITE]: 1,
  [AuthorizationLevel.ADMIN]: 2,
}

const accessFlagsForLevel = (level) => ({
  read: true,
  list: true,
  write: levelPriority[level] >= levelPriority[AuthorizationLevel.WRITE],
  delete: levelPriority[level] >= levelPriority[AuthorizationLevel.WRITE],
  admin: level === AuthorizationLevel.ADMIN,
})

const toUniqueArray = (base, additions = []) => {
  const set = new Set()
  if (Array.isArray(base)) base.forEach((value) => set.add(value))
  else if (base) set.add(base)
  additions.forEach((value) => set.add(value))
  return Array.from(set)
}

const mergeScopes = (existingScope, scopes) => {
  const set = new Set()
  if (typeof existingScope === 'string' && existingScope.trim()) {
    existingScope
      .split(/\s+/)
      .filter(Boolean)
      .forEach((scope) => set.add(scope))
  }
  scopes.forEach((scope) => set.add(scope))
  return Array.from(set).join(' ')
}

class EnhancedTokenGenerator {
  constructor() {
    this.signingSecret = cfg.mcpEnhancedJwtSecret || null
    this.signingKeyId = cfg.mcpEnhancedJwtKid || null
  }

  async generateEnhancedToken({ originalToken, roles = [], buckets = [] }) {
    if (!originalToken) return null

    if (!this.signingSecret) {
      console.warn(
        '⚠️ EnhancedTokenGenerator: Missing signing secret, returning original token',
      )
      return originalToken
    }

    try {
      const decoded = decodeJwt(originalToken)
      const originalHeader = decoded.header || {}
      const originalPayload = decoded.payload || {}

      const canonicalRoles = roles.map(resolveRoleName)
      const authorization = mergeAuthorizationForRoles(canonicalRoles)

      const normalizedBuckets = this.normalizeBuckets(buckets, authorization)
      const permissions = toUniqueArray(
        originalPayload.permissions,
        authorization.awsPermissions,
      ).sort()
      const rolesClaim = toUniqueArray(originalPayload.roles, authorization.roles)
      const groups = toUniqueArray(originalPayload.groups, authorization.groups)
      const scope = mergeScopes(originalPayload.scope, authorization.scopes)
      const bucketNames = normalizedBuckets.map((bucket) => bucket.name)
      const capabilities = buildCapabilities({
        level: authorization.level,
        roles: authorization.roles,
        buckets: bucketNames,
        awsPermissions: permissions,
        tools: authorization.tools,
      })

      const nowIso = new Date().toISOString()

      const enhancedPayload = {
        ...originalPayload,
        scope,
        permissions,
        roles: rolesClaim,
        groups,
        buckets: normalizedBuckets,
        capabilities,
        quilt: {
          enhanced: true,
          generated_at: nowIso,
          authorization_level: authorization.level,
          original_roles: roles,
          resolved_roles: authorization.roles,
        },
        discovery: {
          buckets_discovered: normalizedBuckets.length,
          discovery_method: 'dynamic',
          generated_at: nowIso,
        },
        security: {
          enhanced: true,
          algorithm: 'HS256',
          kid: this.signingKeyId || null,
        },
        token_type: 'enhanced',
        version: originalPayload.version || '2.0',
      }

      const header = {
        ...originalHeader,
        alg: 'HS256',
        typ: originalHeader.typ || 'JWT',
      }
      if (this.signingKeyId) header.kid = this.signingKeyId

      const { token } = await signJwt({
        header,
        payload: enhancedPayload,
        secret: this.signingSecret,
      })

      return token
    } catch (error) {
      console.error('❌ EnhancedTokenGenerator: Failed to enhance token', error)
      return originalToken
    }
  }

  normalizeBuckets(buckets, authorization) {
    const bucketMap = new Map()
    const appendBucket = (bucketName, bucketData = {}) => {
      if (!bucketName) return
      const existing = bucketMap.get(bucketName) || {}
      const accessLevel =
        bucketData.accessLevel || existing.accessLevel || authorization.level
      const permissions =
        bucketData.permissions || existing.permissions || accessFlagsForLevel(accessLevel)
      const awsPermissions = toUniqueArray(
        existing.awsPermissions,
        bucketData.awsPermissions || authorization.awsPermissions,
      ).sort()

      bucketMap.set(bucketName, {
        name: bucketName,
        title: bucketData.title || existing.title || bucketName,
        description: bucketData.description || existing.description || '',
        region: bucketData.region || existing.region || DEFAULT_REGION,
        arn:
          bucketData.arn ||
          existing.arn ||
          (bucketName === '*' ? '*' : `arn:aws:s3:::${bucketName}`),
        accessLevel,
        permissions,
        awsPermissions,
        tags: bucketData.tags || existing.tags || [],
        relevanceScore: bucketData.relevanceScore ?? existing.relevanceScore ?? 0,
        lastIndexed: bucketData.lastIndexed || existing.lastIndexed || null,
      })
    }

    if (Array.isArray(buckets)) {
      buckets.forEach((bucket) => {
        if (!bucket || !bucket.name) return
        appendBucket(bucket.name, bucket)
      })
    }

    const grantedBuckets = Array.isArray(authorization.buckets)
      ? authorization.buckets
      : []

    // If roles grant explicit buckets not present in discovery, include them
    grantedBuckets
      .filter((bucketName) => bucketName && bucketName !== '*')
      .forEach((bucketName) => {
        if (!bucketMap.has(bucketName)) {
          appendBucket(bucketName, { accessLevel: authorization.level })
        }
      })

    if (grantedBuckets.includes('*')) {
      appendBucket('*', { accessLevel: authorization.level })
    }

    return Array.from(bucketMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  getTokenStats(token) {
    try {
      const { payload } = decodeJwt(token)
      return {
        hasScope: Boolean(payload.scope),
        hasPermissions:
          Array.isArray(payload.permissions) && payload.permissions.length > 0,
        hasRoles: Array.isArray(payload.roles) && payload.roles.length > 0,
        hasBuckets: Array.isArray(payload.buckets) && payload.buckets.length > 0,
        bucketCount: Array.isArray(payload.buckets) ? payload.buckets.length : 0,
        permissionCount: Array.isArray(payload.permissions)
          ? payload.permissions.length
          : 0,
        isEnhanced: payload.token_type === 'enhanced',
      }
    } catch (error) {
      return { error: 'Invalid token format' }
    }
  }
}

export { EnhancedTokenGenerator }
