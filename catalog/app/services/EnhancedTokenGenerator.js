/* eslint-disable no-console, no-underscore-dangle */
/**
 * EnhancedTokenGenerator
 *
 * Generates front-end enhanced JWTs with comprehensive authorization claims.
 */

import cfg from 'constants/config'

import { decodeJwt, signJwt } from 'components/Assistant/MCP/decode-token'

import {
  AuthorizationLevel,
  mergeAuthorizationForRoles,
  resolveRoleName,
} from './mcpAuthorization'

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

const normalizeBucketNames = (buckets) => {
  if (!Array.isArray(buckets)) return []
  const seen = new Set()
  const names = []
  buckets.forEach((bucket) => {
    let name = null
    if (typeof bucket === 'string') {
      name = bucket.trim()
    } else if (bucket && typeof bucket.name === 'string') {
      name = bucket.name.trim()
    }
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  })
  return names
}

const safeBase64Encode = (raw) => {
  if (typeof btoa === 'function') return btoa(raw)
  if (typeof Buffer !== 'undefined') return Buffer.from(raw, 'binary').toString('base64')
  throw new Error('Base64 encoding is not available in this environment')
}

const buildBucketCompression = (bucketNames) => {
  if (!Array.isArray(bucketNames) || bucketNames.length === 0) return []
  if (bucketNames.length <= 15) return bucketNames

  const strategies = []

  const bucketGroups = {}
  bucketNames.forEach((bucket) => {
    const prefix = bucket.split('-')[0]
    if (!bucketGroups[prefix]) bucketGroups[prefix] = []
    bucketGroups[prefix].push(bucket.replace(`${prefix}-`, ''))
  })
  if (Object.keys(bucketGroups).length < bucketNames.length * 0.6) {
    strategies.push({
      type: 'groups',
      data: bucketGroups,
      size: JSON.stringify(bucketGroups).length,
    })
  }

  try {
    const compressed = safeBase64Encode(JSON.stringify(bucketNames))
    strategies.push({ type: 'compressed', data: compressed, size: compressed.length })
  } catch (error) {
    console.warn('⚠️ EnhancedTokenGenerator: Bucket compression via base64 failed', error)
  }

  const patterns = {}
  bucketNames.forEach((bucket) => {
    if (bucket.startsWith('quilt-')) {
      if (!patterns.quilt) patterns.quilt = []
      patterns.quilt.push(bucket.replace('quilt-', ''))
    } else if (bucket.startsWith('cell')) {
      if (!patterns.cell) patterns.cell = []
      patterns.cell.push(bucket)
    } else {
      if (!patterns.other) patterns.other = []
      patterns.other.push(bucket)
    }
  })
  if (Object.keys(patterns).length < bucketNames.length * 0.7) {
    strategies.push({
      type: 'patterns',
      data: patterns,
      size: JSON.stringify(patterns).length,
    })
  }

  if (strategies.length === 0) return bucketNames

  const originalSize = JSON.stringify(bucketNames).length
  const bestStrategy = strategies.reduce((best, current) =>
    current.size < best.size ? current : best,
  )

  if (bestStrategy.size < originalSize) {
    return {
      _type: bestStrategy.type,
      _data: bestStrategy.data,
    }
  }

  return bucketNames
}

class EnhancedTokenGenerator {
  constructor() {
    this.signingSecret = cfg.mcpEnhancedJwtSecret || null
    this.signingKeyId = cfg.mcpEnhancedJwtKid || null

    // Debug: Log config values
    console.log('🔍 EnhancedTokenGenerator: Full config object:', cfg)
    console.log('🔍 EnhancedTokenGenerator: Config values:', {
      mcpEnhancedJwtSecret: cfg.mcpEnhancedJwtSecret,
      mcpEnhancedJwtKid: cfg.mcpEnhancedJwtKid,
      hasSigningSecret: !!this.signingSecret,
      hasSigningKeyId: !!this.signingKeyId,
    })
  }

  async generateEnhancedToken({ originalToken, roles = [], buckets = [] }) {
    if (!originalToken) return null

    console.log('🔍 EnhancedTokenGenerator: generateEnhancedToken called with:', {
      hasOriginalToken: !!originalToken,
      rolesCount: roles.length,
      bucketsCount: buckets.length,
      signingSecret: this.signingSecret ? 'present' : 'missing',
      signingKeyId: this.signingKeyId ? 'present' : 'missing',
    })

    if (!this.signingSecret) {
      console.warn(
        '⚠️ EnhancedTokenGenerator: Missing signing secret, returning original token',
      )
      return originalToken
    }

    try {
      const { payload: originalPayload = {} } = decodeJwt(originalToken)

      const canonicalRoles = roles.map(resolveRoleName)
      console.log('🔍 EnhancedTokenGenerator: Role processing:', {
        inputRoles: roles,
        canonicalRoles: canonicalRoles,
        roleCount: canonicalRoles.length,
      })

      // Debug role resolution
      console.log('🔍 Role Resolution Debug:', {
        'Input Role': roles[0],
        'Resolved Role': canonicalRoles[0],
        'Is Same Role': roles[0] === canonicalRoles[0],
        'Role Resolution Applied': roles[0] !== canonicalRoles[0],
      })

      const authorization = mergeAuthorizationForRoles(canonicalRoles)
      console.log('🔍 EnhancedTokenGenerator: Authorization result:', {
        level: authorization.level,
        roles: authorization.roles,
        awsPermissions: authorization.awsPermissions?.length || 0,
        tools: authorization.tools?.length || 0,
      })

      // Detailed role debugging
      console.log('🔍 Role Processing Details:', {
        'Input Roles': roles,
        'Canonical Roles': canonicalRoles,
        'Authorization Level': authorization.level,
        'Authorization Roles': authorization.roles,
        'AWS Permissions Count': authorization.awsPermissions?.length || 0,
        'First 10 AWS Permissions': authorization.awsPermissions?.slice(0, 10) || [],
        'Tools Count': authorization.tools?.length || 0,
        'Is Write Level': authorization.level === 'write',
        'Is Admin Level': authorization.level === 'admin',
      })

      const bucketNames = normalizeBucketNames(buckets)
      const bucketValidationIssues = []

      if (bucketNames.length === 0) {
        bucketValidationIssues.push('No bucket names resolved for JWT payload')
      }

      const invalidBucketNames = bucketNames.filter(
        (name) => !name || typeof name !== 'string',
      )
      if (invalidBucketNames.length > 0) {
        bucketValidationIssues.push('Invalid bucket names detected')
      }

      if (bucketValidationIssues.length > 0) {
        console.warn('⚠️ EnhancedTokenGenerator: Bucket validation failed', {
          issues: bucketValidationIssues,
          rawBuckets: buckets,
        })
        return originalToken
      }

      const compressedBuckets = buildBucketCompression(bucketNames)

      // Use abbreviated permission names to save space
      const permissionAbbreviations = {
        's3:GetObject': 'g',
        's3:PutObject': 'p',
        's3:DeleteObject': 'd',
        's3:ListBucket': 'l',
        's3:ListAllMyBuckets': 'la',
        's3:GetObjectVersion': 'gv',
        's3:PutObjectAcl': 'pa',
        's3:AbortMultipartUpload': 'amu',
      }

      // Convert permissions to abbreviated form
      const abbreviatedPermissions = Array.from(authorization.awsPermissions)
        .map((perm) => permissionAbbreviations[perm] || perm)
        .filter(Boolean)

      const rolesClaim = toUniqueArray(originalPayload.roles, authorization.roles)
      const scope = 'w' // Single character scope
      const fullPermissions = Array.from(authorization.awsPermissions).sort()

      const enhancedPayload = {
        ...originalPayload,
        // Standard JWT claims
        iss: originalPayload.iss || 'quilt-frontend',
        aud: originalPayload.aud || 'quilt-mcp-server',
        sub: originalPayload.sub || originalPayload.id,
        iat: Math.floor(Date.now() / 1000),
        exp: originalPayload.exp || Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
        jti:
          originalPayload.jti ||
          `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 4)}`,

        // Ultra-compact claims for 8KB limit
        s: scope, // Single char scope
        p: abbreviatedPermissions, // Abbreviated permissions
        r: rolesClaim, // Shortened key
        b: compressedBuckets, // Shortened key, supports compressed claims
        buckets: bucketNames, // Full bucket list for downstream consumers
        permissions: fullPermissions,
        roles: rolesClaim,
        scope,
        level: authorization.level,
        l: authorization.level, // Shortened key
      }

      // Debug: Show what's actually in the JWT payload
      console.log('🔍 EnhancedTokenGenerator: JWT payload bucket data:', {
        'b (compressed)': enhancedPayload.b,
        'buckets (full)': enhancedPayload.buckets?.slice(0, 5),
        'buckets count': enhancedPayload.buckets?.length || 0,
      })

      const header = {
        alg: 'HS256',
        typ: 'JWT',
      }
      if (this.signingKeyId) header.kid = this.signingKeyId

      const { token } = await signJwt({
        header,
        payload: enhancedPayload,
        secret: this.signingSecret,
      })

      console.log('✅ EnhancedTokenGenerator: Token generated successfully')

      // Check token size
      const tokenSizeKB = Math.round((token.length / 1024) * 100) / 100
      const isUnder8KB = tokenSizeKB < 8

      console.log('🔍 EnhancedTokenGenerator: Final JWT claims:', {
        roles: enhancedPayload.r?.length || 0,
        permissions: enhancedPayload.p,
        buckets: bucketNames.length,
        bucketNames: bucketNames.slice(0, 10), // Show first 10 bucket names
        scope: enhancedPayload.s,
        authorizationLevel: enhancedPayload.l,
        tokenSizeKB: `${tokenSizeKB}KB`,
        under8KB: isUnder8KB ? '✅' : '❌',
      })

      // Log compression details for debugging
      if (typeof compressedBuckets === 'object' && compressedBuckets._type) {
        console.log('📦 Bucket compression applied:', {
          type: compressedBuckets._type,
          originalCount: bucketNames.length,
          compressedSize: JSON.stringify(compressedBuckets).length,
          compressedData: compressedBuckets._data,
        })
      } else {
        console.log(
          '📦 Bucket compression: No compression applied, using direct array:',
          {
            bucketCount: bucketNames.length,
            firstFewBuckets: bucketNames.slice(0, 5),
          },
        )
      }

      if (!isUnder8KB) {
        console.warn(`⚠️ JWT token is ${tokenSizeKB}KB, exceeds 8KB limit!`)
      }

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
