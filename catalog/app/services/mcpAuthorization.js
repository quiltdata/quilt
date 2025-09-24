/**
 * Shared authorization definitions for MCP enhanced token generation.
 * Mirrors the backend BearerAuthService role and tool mappings so the
 * frontend can construct consistent authorization claims.
 */

export const AuthorizationLevel = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
}

const levelPriority = {
  [AuthorizationLevel.READ]: 0,
  [AuthorizationLevel.WRITE]: 1,
  [AuthorizationLevel.ADMIN]: 2,
}

// AWS permissions required per tool, based on quilt-mcp-server mappings.
export const TOOL_PERMISSION_MAP = {
  // S3 Bucket Operations
  bucket_objects_list: ['s3:ListBucket', 's3:GetBucketLocation'],
  bucket_object_info: ['s3:GetObject', 's3:GetObjectVersion'],
  bucket_object_text: ['s3:GetObject'],
  bucket_object_fetch: ['s3:GetObject', 's3:GetObjectVersion'],
  bucket_objects_put: ['s3:PutObject', 's3:PutObjectAcl'],
  bucket_object_link: ['s3:GetObject'],

  // Package Operations
  package_create: ['s3:PutObject', 's3:PutObjectAcl', 's3:ListBucket', 's3:GetObject'],
  package_update: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
  package_delete: ['s3:DeleteObject', 's3:ListBucket'],
  package_browse: ['s3:ListBucket', 's3:GetObject'],
  package_contents_search: ['s3:ListBucket'],
  package_diff: ['s3:ListBucket', 's3:GetObject'],

  // Unified Package Operations
  create_package_enhanced: [
    's3:PutObject',
    's3:PutObjectAcl',
    's3:ListBucket',
    's3:GetObject',
  ],
  create_package_from_s3: [
    's3:ListBucket',
    's3:GetObject',
    's3:PutObject',
    's3:PutObjectAcl',
  ],
  package_create_from_s3: [
    's3:ListBucket',
    's3:GetObject',
    's3:PutObject',
    's3:PutObjectAcl',
  ],

  // Athena/Glue Operations
  athena_query_execute: [
    'athena:StartQueryExecution',
    'athena:GetQueryExecution',
    'athena:GetQueryResults',
    'athena:StopQueryExecution',
  ],
  athena_databases_list: ['glue:GetDatabases'],
  athena_tables_list: ['glue:GetTables', 'glue:GetDatabase'],
  athena_table_schema: ['glue:GetTable', 'glue:GetDatabase'],
  athena_workgroups_list: ['athena:ListWorkGroups'],
  athena_query_history: ['athena:ListQueryExecutions', 'athena:BatchGetQueryExecution'],

  // Tabulator Operations
  tabulator_tables_list: ['glue:GetDatabases', 'glue:GetTables'],
  tabulator_table_create: ['glue:CreateTable', 'glue:GetTable', 's3:ListBucket'],

  // Search Operations
  unified_search: ['s3:ListBucket', 'glue:GetTables', 'glue:GetDatabases'],
  packages_search: ['s3:ListBucket'],

  // Permission Discovery
  aws_permissions_discover: [
    'iam:ListAttachedUserPolicies',
    'iam:ListUserPolicies',
    'iam:GetPolicy',
    'iam:GetPolicyVersion',
  ],
  bucket_access_check: ['s3:ListBucket', 's3:GetBucketLocation'],
  bucket_recommendations_get: ['s3:ListAllMyBuckets'],
}

export const ROLE_DEFINITIONS = {
  'ReadWriteQuiltV2-sales-prod': {
    level: AuthorizationLevel.WRITE,
    buckets: [
      'cellpainting-gallery',
      'cellxgene-913524946226-us-east-1',
      'cellxgene-census-public-us-west-2',
      'data-drop-off-bucket',
      'example-pharma-data',
      'fl-158-raw',
      'fl-159-raw',
      'fl-160-raw',
      'fl-data-commons',
      'ganymede-sandbox-bucket',
      'gdc-ccle-2-open',
      'nf-core-gallery',
      'omics-quilt-omicsquiltckainput850787717197useast13-58epjlyt5mcp',
      'omics-quilt-omicsquiltckaoutput850787717197useast1-gpux2jtjucm8',
      'pmc-oa-opendata',
      'quilt-bake',
      'quilt-benchling',
      'quilt-ccle-pipeline-runs',
      'quilt-cro',
      'quilt-demos',
      'quilt-example-bucket',
      'quilt-open-ccle-virginia',
      'quilt-sales-raw',
      'quilt-sales-staging',
      'quilt-sandbox-bucket',
      'quilt-zs-sandbox',
      'sales-prod-canarybucketallowed-eiho3ns9whcm',
      'sales-prod-canarybucketrestricted-dekwbvtya45f',
      'sales-prod-statusreportsbucket-tfbzum70dfu7',
      'sra-pub-run-odp',
      'udp-spec',
      'zs-discovery-omics',
    ],
    tools: [
      'bucket_objects_list',
      'bucket_object_info',
      'bucket_object_text',
      'bucket_object_fetch',
      'bucket_objects_put',
      'bucket_object_link',
      'package_create',
      'package_update',
      'package_delete',
      'package_browse',
      'package_contents_search',
      'package_diff',
      'create_package_enhanced',
      'create_package_from_s3',
      'package_create_from_s3',
      'athena_query_execute',
      'athena_databases_list',
      'athena_tables_list',
      'athena_table_schema',
      'athena_workgroups_list',
      'athena_query_history',
      'tabulator_tables_list',
      'unified_search',
      'packages_search',
      'aws_permissions_discover',
      'bucket_access_check',
      'bucket_recommendations_get',
    ],
    groups: ['quilt-users', 'mcp-users', 'quilt-contributors'],
  },
  ReadOnlyQuilt: {
    level: AuthorizationLevel.READ,
    buckets: ['quilt-sandbox-bucket'],
    tools: [
      'bucket_objects_list',
      'bucket_object_info',
      'bucket_object_text',
      'bucket_object_fetch',
      'bucket_object_link',
      'package_browse',
      'package_contents_search',
      'package_diff',
      'athena_query_execute',
      'athena_databases_list',
      'athena_tables_list',
      'athena_table_schema',
      'athena_workgroups_list',
      'athena_query_history',
      'tabulator_tables_list',
      'unified_search',
      'packages_search',
      'aws_permissions_discover',
      'bucket_access_check',
      'bucket_recommendations_get',
    ],
    groups: ['quilt-users', 'mcp-users'],
  },
  AdminQuilt: {
    level: AuthorizationLevel.ADMIN,
    buckets: ['*'],
    tools: ['*'],
    groups: ['quilt-admins', 'quilt-users', 'mcp-users'],
  },
}

export const ROLE_ALIASES = {
  ReadQuiltV2: 'ReadOnlyQuilt',
  'ReadQuiltV2-sales-prod': 'ReadOnlyQuilt',
  ReadWriteQuiltBucket: 'ReadWriteQuiltV2-sales-prod',
  QuiltContributorRole: 'ReadWriteQuiltV2-sales-prod',
  QuiltPresentationRole: 'ReadOnlyQuilt',
}

const LEVEL_SCOPES = {
  [AuthorizationLevel.READ]: ['read', 'list'],
  [AuthorizationLevel.WRITE]: ['read', 'write', 'list', 'delete'],
  [AuthorizationLevel.ADMIN]: ['read', 'write', 'list', 'delete', 'admin', 'manage'],
}

export const LEVEL_BASE_PERMISSIONS = {
  [AuthorizationLevel.READ]: new Set([
    's3:GetObject',
    's3:GetObjectVersion',
    's3:GetBucketLocation',
    's3:ListBucket',
    's3:ListAllMyBuckets', // Critical: Required for bucket discovery
  ]),
  [AuthorizationLevel.WRITE]: new Set([
    's3:GetObject',
    's3:GetObjectVersion',
    's3:GetBucketLocation',
    's3:ListBucket',
    's3:ListAllMyBuckets', // Critical: Required for bucket discovery
    's3:PutObject',
    's3:PutObjectAcl',
    's3:DeleteObject',
    's3:AbortMultipartUpload',
  ]),
  [AuthorizationLevel.ADMIN]: new Set([
    's3:GetObject',
    's3:GetObjectVersion',
    's3:GetBucketLocation',
    's3:ListBucket',
    's3:ListAllMyBuckets', // Critical: Required for bucket discovery
    's3:PutObject',
    's3:PutObjectAcl',
    's3:DeleteObject',
    's3:AbortMultipartUpload',
    's3:PutBucketPolicy',
    's3:GetBucketPolicy',
    'iam:PassRole',
  ]),
}

const collectToolPermissions = (toolNames) => {
  if (!toolNames || !toolNames.length) return []
  if (toolNames.includes('*')) {
    return Object.values(TOOL_PERMISSION_MAP).flat()
  }
  const permissions = []
  toolNames.forEach((tool) => {
    const mapped = TOOL_PERMISSION_MAP[tool]
    if (mapped) permissions.push(...mapped)
  })
  return permissions
}

export const resolveRoleName = (role) => ROLE_ALIASES[role] || role

const pickHigherLevel = (current, next) =>
  levelPriority[next] > levelPriority[current] ? next : current

const sortUnique = (iterable) => Array.from(new Set(iterable)).sort()

export const mergeAuthorizationForRoles = (roles) => {
  if (!Array.isArray(roles))
    return {
      level: AuthorizationLevel.READ,
      roles: [],
      scopes: [],
      groups: [],
      buckets: [],
      awsPermissions: [],
      tools: [],
    }

  let highestLevel = AuthorizationLevel.READ
  const bucketSet = new Set()
  const groupSet = new Set()
  const permissionSet = new Set()
  const toolSet = new Set()
  const resolvedRoles = []

  roles.forEach((role) => {
    const canonical = resolveRoleName(role)
    const definition = ROLE_DEFINITIONS[canonical]
    if (!definition) return
    resolvedRoles.push(canonical)
    if (definition.level === AuthorizationLevel.ADMIN) {
      highestLevel = AuthorizationLevel.ADMIN
    } else if (
      definition.level === AuthorizationLevel.WRITE &&
      highestLevel !== AuthorizationLevel.ADMIN
    ) {
      highestLevel = AuthorizationLevel.WRITE
    }

    if (definition.buckets.includes('*')) {
      bucketSet.clear()
      bucketSet.add('*')
    }
    if (!bucketSet.has('*')) {
      definition.buckets.forEach((bucket) => bucketSet.add(bucket))
    }

    definition.groups?.forEach((group) => groupSet.add(group))

    collectToolPermissions(definition.tools).forEach((perm) => permissionSet.add(perm))
    if (definition.tools.includes('*')) {
      Object.keys(TOOL_PERMISSION_MAP).forEach((tool) => toolSet.add(tool))
    } else {
      definition.tools.forEach((tool) => toolSet.add(tool))
    }

    LEVEL_BASE_PERMISSIONS[definition.level].forEach((perm) => permissionSet.add(perm))
  })

  const scopes = new Set()
  LEVEL_SCOPES[highestLevel].forEach((scope) => scopes.add(scope))

  return {
    level: highestLevel,
    roles: sortUnique(resolvedRoles.length ? resolvedRoles : roles),
    scopes: sortUnique(scopes),
    groups: sortUnique(groupSet),
    buckets: sortUnique(bucketSet),
    awsPermissions: sortUnique(permissionSet),
    tools: sortUnique(toolSet),
  }
}

export const deriveBucketAccess = (roles, discoveredBucketNames = []) => {
  const normalized = Array.isArray(roles) ? roles.map(resolveRoleName) : []
  const validRoles = normalized.filter((name) => ROLE_DEFINITIONS[name])
  const bucketNames = new Set()
  const bucketLevelMap = new Map()
  const bucketPermissionMap = new Map()
  let wildcardLevel = null

  validRoles.forEach((roleName) => {
    const definition = ROLE_DEFINITIONS[roleName]
    if (!definition) return

    const targetBuckets = definition.buckets.includes('*') ? null : definition.buckets

    if (targetBuckets) {
      targetBuckets.forEach((bucket) => {
        if (bucket === '*') return
        bucketNames.add(bucket)
        const currentLevel = bucketLevelMap.get(bucket) || AuthorizationLevel.READ
        bucketLevelMap.set(bucket, pickHigherLevel(currentLevel, definition.level))
        if (!bucketPermissionMap.has(bucket)) bucketPermissionMap.set(bucket, new Set())
        const permSet = bucketPermissionMap.get(bucket)
        LEVEL_BASE_PERMISSIONS[definition.level].forEach((perm) => permSet.add(perm))
        collectToolPermissions(definition.tools).forEach((perm) => permSet.add(perm))
      })
    } else {
      // Wildcard applies to all known buckets
      wildcardLevel = wildcardLevel
        ? pickHigherLevel(wildcardLevel, definition.level)
        : definition.level
    }
  })

  return {
    bucketNames: Array.from(bucketNames),
    discoveredBucketNames: Array.from(new Set(discoveredBucketNames)),
    bucketLevelMap,
    bucketPermissionMap,
    wildcardLevel,
  }
}

export const buildCapabilities = ({ level, roles, buckets, awsPermissions, tools }) => {
  const caps = new Set(['mcp:tools:execute'])
  roles.forEach((role) => caps.add(`role:${role}`))
  caps.add(`authorization:${level}`)
  buckets.forEach((bucket) => caps.add(`bucket:${bucket}:${level}`))
  tools.forEach((tool) => caps.add(`tool:${tool}`))
  awsPermissions.forEach((perm) => {
    const [service] = perm.split(':')
    if (service) caps.add(`service:${service.toLowerCase()}`)
  })
  return sortUnique(caps)
}

export const resolveBucketsWithAccessLevel = (roles) => {
  const merged = mergeAuthorizationForRoles(roles)
  const buckets = merged.buckets.includes('*') ? ['*'] : merged.buckets
  return buckets.map((bucket) => ({
    name: bucket,
    accessLevel: merged.level,
  }))
}

export default {
  AuthorizationLevel,
  TOOL_PERMISSION_MAP,
  ROLE_DEFINITIONS,
  ROLE_ALIASES,
  mergeAuthorizationForRoles,
  resolveRoleName,
  buildCapabilities,
  resolveBucketsWithAccessLevel,
  deriveBucketAccess,
}
