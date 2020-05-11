import * as R from 'ramda'

import * as Cache from 'utils/ResourceCache'

export const RolesResource = Cache.createResource({
  name: 'Admin.data.roles',
  fetch: ({ req }) => req({ endpoint: '/roles' }).then(R.prop('results')),
  key: () => null,
})

export const UsersResource = Cache.createResource({
  name: 'Admin.data.users',
  fetch: ({ req }) =>
    req({ endpoint: '/users/list' }).then(
      R.pipe(
        R.prop('results'),
        R.map((u) => ({
          dateJoined: new Date(u.date_joined),
          email: u.email,
          isActive: u.is_active,
          isAdmin: u.is_superuser,
          lastLogin: new Date(u.last_login),
          username: u.username,
          roleId: u.role_id,
        })),
      ),
    ),
  key: () => null,
})

export const bucketFromJSON = (b) => ({
  name: b.name,
  title: b.title,
  description: b.description,
  iconUrl: b.icon_url,
  overviewUrl: b.overview_url,
  linkedData: b.schema_org, // object
  relevanceScore: b.relevance_score, // integer
  tags: b.tags, // list of strings
  lastIndexed: b.last_indexed && new Date(b.last_indexed),
  fileExtensionsToIndex: b.file_extensions_to_index, // list of strings
  scannerParallelShardsDepth: b.scanner_parallel_shards_depth, // integer
  skipMetaDataIndexing: b.skip_meta_data_indexing, // bool
  snsNotificationArn: b.sns_notification_arn,
})

export const BucketsResource = Cache.createResource({
  name: 'Admin.data.buckets',
  fetch: ({ req }) =>
    req({ endpoint: '/admin/buckets' }).then(
      R.pipe(R.prop('results'), R.map(bucketFromJSON)),
    ),
  key: () => null,
})
