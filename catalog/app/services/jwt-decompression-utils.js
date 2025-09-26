/* eslint-disable no-console, no-underscore-dangle */
/**
 * JWT Decompression Utilities for MCP Server
 *
 * This utility provides functions to decompress JWT tokens from the frontend
 * that use abbreviated permissions and compressed bucket data.
 */

// Permission abbreviation mapping
const PERMISSION_ABBREVIATIONS = {
  g: 's3:GetObject',
  p: 's3:PutObject',
  d: 's3:DeleteObject',
  l: 's3:ListBucket',
  la: 's3:ListAllMyBuckets',
  gv: 's3:GetObjectVersion',
  pa: 's3:PutObjectAcl',
  amu: 's3:AbortMultipartUpload',
}

/**
 * Decompress abbreviated permissions back to full AWS permission strings
 * @param {string[]} abbreviatedPermissions - Array of abbreviated permission strings
 * @returns {string[]} Array of full AWS permission strings
 */
function decompressPermissions(abbreviatedPermissions) {
  if (!Array.isArray(abbreviatedPermissions)) {
    return []
  }

  return abbreviatedPermissions.map(
    (abbrev) => PERMISSION_ABBREVIATIONS[abbrev] || abbrev,
  )
}

/**
 * Decompress bucket data based on compression type
 * @param {any} bucketData - Compressed bucket data (array or object with _type)
 * @returns {string[]} Array of full bucket names
 */
function decompressBuckets(bucketData) {
  // If it's already an array, no compression was applied
  if (Array.isArray(bucketData)) {
    return bucketData
  }

  // If it's not an object or doesn't have _type, return as-is
  if (!bucketData || typeof bucketData !== 'object' || !bucketData._type) {
    return Array.isArray(bucketData) ? bucketData : []
  }

  const compressionType = bucketData._type
  const data = bucketData._data

  switch (compressionType) {
    case 'groups':
      return decompressGroups(data)
    case 'patterns':
      return decompressPatterns(data)
    case 'compressed':
      return decompressCompressed(data)
    default:
      console.warn(`Unknown compression type: ${compressionType}`)
      return []
  }
}

/**
 * Decompress grouped bucket data
 * @param {Object} groupedData - Object with prefix keys and bucket suffix arrays
 * @returns {string[]} Array of full bucket names
 */
function decompressGroups(groupedData) {
  const buckets = []

  for (const [prefix, bucketSuffixes] of Object.entries(groupedData)) {
    if (Array.isArray(bucketSuffixes)) {
      for (const suffix of bucketSuffixes) {
        if (prefix === 'quilt') {
          buckets.push(`quilt-${suffix}`)
        } else {
          buckets.push(`${prefix}-${suffix}`)
        }
      }
    }
  }

  return buckets
}

/**
 * Decompress pattern-based bucket data
 * @param {Object} patternData - Object with pattern keys and bucket arrays
 * @returns {string[]} Array of full bucket names
 */
function decompressPatterns(patternData) {
  const buckets = []

  for (const [pattern, bucketList] of Object.entries(patternData)) {
    if (Array.isArray(bucketList)) {
      if (pattern === 'quilt') {
        // Add 'quilt-' prefix to each bucket
        for (const bucket of bucketList) {
          buckets.push(`quilt-${bucket}`)
        }
      } else if (pattern === 'cell') {
        // Keep cell buckets as-is
        buckets.push(...bucketList)
      } else {
        // Other patterns - keep as-is
        buckets.push(...bucketList)
      }
    }
  }

  return buckets
}

/**
 * Decompress base64 encoded bucket data
 * @param {string} compressedData - Base64 encoded JSON string
 * @returns {string[]} Array of bucket names
 */
function decompressCompressed(compressedData) {
  try {
    const decoded = atob(compressedData)
    const parsed = JSON.parse(decoded)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to decompress bucket data:', error)
    return []
  }
}

/**
 * Process a compressed JWT payload and return standard format
 * @param {Object} jwtPayload - The JWT payload object
 * @returns {Object} Standard JWT payload with decompressed data
 */
function processCompressedJWT(jwtPayload) {
  if (!jwtPayload || typeof jwtPayload !== 'object') {
    return {
      scope: 'read',
      permissions: [],
      roles: [],
      buckets: [],
      level: 'read',
    }
  }

  // Extract compressed and expanded fields with graceful fallbacks
  const scope = jwtPayload.s || jwtPayload.scope || ''
  const compressedPermissions = Array.isArray(jwtPayload.p) ? jwtPayload.p : []
  const explicitPermissions = Array.isArray(jwtPayload.permissions)
    ? jwtPayload.permissions
    : null
  const compressedRoles = Array.isArray(jwtPayload.r) ? jwtPayload.r : []
  const explicitRoles = Array.isArray(jwtPayload.roles) ? jwtPayload.roles : null
  const compressedBuckets = jwtPayload.b !== undefined ? jwtPayload.b : []
  const explicitBuckets = Array.isArray(jwtPayload.buckets) ? jwtPayload.buckets : null
  const level = jwtPayload.l || jwtPayload.level || 'read'

  const fullPermissions =
    explicitPermissions || decompressPermissions(compressedPermissions)
  const fullBuckets = explicitBuckets || decompressBuckets(compressedBuckets)
  const fullRoles = explicitRoles || compressedRoles

  // Return standard format
  return {
    scope,
    permissions: fullPermissions,
    roles: fullRoles,
    buckets: fullBuckets,
    level,
    iss: jwtPayload.iss,
    aud: jwtPayload.aud,
    sub: jwtPayload.sub,
    iat: jwtPayload.iat,
    exp: jwtPayload.exp,
    jti: jwtPayload.jti,
  }
}

/**
 * Safely decompress JWT with fallbacks for errors
 * @param {Object} jwtPayload - The JWT payload object
 * @returns {Object} Standard JWT payload with fallback values
 */
function safeDecompressJWT(jwtPayload) {
  try {
    return processCompressedJWT(jwtPayload)
  } catch (error) {
    console.error('JWT decompression failed:', error)

    // Return minimal valid payload as fallback
    return {
      scope: jwtPayload?.s || jwtPayload?.scope || 'read',
      permissions: Array.isArray(jwtPayload?.permissions)
        ? jwtPayload.permissions
        : ['s3:GetObject'],
      roles: Array.isArray(jwtPayload?.roles) ? jwtPayload.roles : jwtPayload?.r || [],
      buckets: Array.isArray(jwtPayload?.buckets) ? jwtPayload.buckets : [],
      level: jwtPayload?.l || jwtPayload?.level || 'read',
      iss: jwtPayload.iss,
      aud: jwtPayload.aud,
      sub: jwtPayload.sub,
      iat: jwtPayload.iat,
      exp: jwtPayload.exp,
      jti: jwtPayload.jti,
    }
  }
}

// Export functions for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    decompressPermissions,
    decompressBuckets,
    decompressGroups,
    decompressPatterns,
    decompressCompressed,
    processCompressedJWT,
    safeDecompressJWT,
    PERMISSION_ABBREVIATIONS,
  }
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.JWTDecompression = {
    decompressPermissions,
    decompressBuckets,
    decompressGroups,
    decompressPatterns,
    decompressCompressed,
    processCompressedJWT,
    safeDecompressJWT,
    PERMISSION_ABBREVIATIONS,
  }
}

// Example usage and tests
if (typeof window !== 'undefined' && window.console) {
  console.log('JWT Decompression Utils loaded. Available functions:')
  console.log('- decompressPermissions(abbreviatedPermissions)')
  console.log('- decompressBuckets(bucketData)')
  console.log('- processCompressedJWT(jwtPayload)')
  console.log('- safeDecompressJWT(jwtPayload)')
}
