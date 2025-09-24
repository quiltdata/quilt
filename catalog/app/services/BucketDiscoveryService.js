import cfg from 'constants/config'

import {
  AuthorizationLevel,
  LEVEL_BASE_PERMISSIONS,
  mergeAuthorizationForRoles,
  resolveBucketsWithAccessLevel,
  deriveBucketAccess,
} from './mcpAuthorization'

const levelPriority = {
  [AuthorizationLevel.READ]: 0,
  [AuthorizationLevel.WRITE]: 1,
  [AuthorizationLevel.ADMIN]: 2,
}

const buildAccessFlags = (level) => ({
  read: true,
  list: true,
  write: levelPriority[level] >= levelPriority[AuthorizationLevel.WRITE],
  delete: levelPriority[level] >= levelPriority[AuthorizationLevel.WRITE],
  admin: level === AuthorizationLevel.ADMIN,
})

class BucketDiscoveryService {
  constructor() {
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
    this.lastDiscovery = 0
    this.cachedBuckets = null
    this.cachedRoleKey = null
  }

  async getAccessibleBuckets({ token, roles }) {
    const roleKey = Array.isArray(roles) ? [...roles].sort().join('|') : ''
    const now = Date.now()
    if (
      this.cachedBuckets &&
      this.cachedRoleKey === roleKey &&
      now - this.lastDiscovery < this.cacheTimeout
    ) {
      return this.cachedBuckets
    }

    try {
      const bucketConfigs = await this.fetchBucketConfigs(token)
      const buckets = this.mergeBucketsWithRoles(bucketConfigs, roles)
      this.cachedBuckets = buckets
      this.lastDiscovery = now
      this.cachedRoleKey = roleKey
      return buckets
    } catch (error) {
      console.error('❌ BucketDiscoveryService: Error discovering buckets', error)
      return this.buildFallbackBuckets(roles)
    }
  }

  async fetchBucketConfigs(token) {
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch API is not available')
    }

    const response = await fetch(`${cfg.registryUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query: `query BucketDiscovery {
          bucketConfigs {
            name
            title
            description
            tags
            relevanceScore
            lastIndexed
          }
        }`,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Bucket discovery failed (${response.status}): ${text}`)
    }

    const body = await response.json()
    if (body.errors) {
      throw new Error(`Bucket discovery GraphQL errors: ${JSON.stringify(body.errors)}`)
    }

    return body.data?.bucketConfigs ?? []
  }

  mergeBucketsWithRoles(configs, roles) {
    const normalizedRoles = Array.isArray(roles) ? roles : []
    const authorization = mergeAuthorizationForRoles(normalizedRoles)
    const {
      bucketNames: explicitBucketNames,
      discoveredBucketNames,
      bucketLevelMap,
      bucketPermissionMap,
      wildcardLevel,
    } = deriveBucketAccess(
      normalizedRoles,
      configs.map((cfg) => cfg.name),
    )

    const allBucketNames = new Set(explicitBucketNames)
    if (wildcardLevel) {
      discoveredBucketNames.forEach((name) => allBucketNames.add(name))
    }

    const configsByName = new Map(configs.map((cfg) => [cfg.name, cfg]))
    const buckets = Array.from(allBucketNames).map((bucketName) => {
      const level = bucketLevelMap.get(bucketName) || wildcardLevel || authorization.level
      const config = configsByName.get(bucketName)
      const permissions = buildAccessFlags(level)

      const permissionSet = new Set(authorization.awsPermissions)
      const specific = bucketPermissionMap.get(bucketName)
      if (specific) {
        specific.forEach((perm) => permissionSet.add(perm))
      } else if (wildcardLevel) {
        LEVEL_BASE_PERMISSIONS[wildcardLevel].forEach((perm) => permissionSet.add(perm))
      }

      return {
        name: bucketName,
        title: config?.title || bucketName,
        description: config?.description || '',
        tags: config?.tags || [],
        relevanceScore: config?.relevanceScore ?? 0,
        lastIndexed: config?.lastIndexed,
        region: 'us-east-1',
        arn: `arn:aws:s3:::${bucketName}`,
        accessLevel: level,
        permissions,
        awsPermissions: Array.from(permissionSet).sort(),
      }
    })

    return buckets
  }

  buildFallbackBuckets(roles) {
    return resolveBucketsWithAccessLevel(roles || []).map((bucket) => ({
      name: bucket.name === '*' ? 'quilt-sandbox-bucket' : bucket.name,
      title: bucket.name === '*' ? 'Default Quilt Bucket' : bucket.name,
      description: 'Fallback bucket entry generated locally',
      region: 'us-east-1',
      arn: `arn:aws:s3:::${bucket.name === '*' ? 'quilt-sandbox-bucket' : bucket.name}`,
      accessLevel: bucket.accessLevel,
      permissions: buildAccessFlags(bucket.accessLevel),
      awsPermissions: mergeAuthorizationForRoles(roles || []).awsPermissions,
      tags: [],
      relevanceScore: 0,
    }))
  }

  async refreshBuckets(params) {
    this.lastDiscovery = 0
    this.cachedBuckets = null
    this.cachedRoleKey = null
    return this.getAccessibleBuckets(params)
  }

  getCacheStats() {
    return {
      lastDiscovery: this.lastDiscovery,
      cacheAge: Date.now() - this.lastDiscovery,
      cacheTimeout: this.cacheTimeout,
      isStale: Date.now() - this.lastDiscovery > this.cacheTimeout,
      cachedBuckets: this.cachedBuckets?.length || 0,
    }
  }

  clearCache() {
    this.lastDiscovery = 0
    this.cachedBuckets = null
    this.cachedRoleKey = null
  }
}

export { BucketDiscoveryService }
