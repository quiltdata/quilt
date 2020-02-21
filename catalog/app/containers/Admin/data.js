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

export const BucketsResource = Cache.createResource({
  name: 'Admin.data.buckets',
  fetch: ({ req }) =>
    req({ endpoint: '/admin/buckets' }).then(
      R.pipe(
        R.prop('results'),
        R.map((b) => ({
          name: b.name,
          title: b.title,
          description: b.description,
          iconUrl: b.icon_url,
          overviewUrl: b.overview_url,
          linkedData: b.schema_org,
          relevanceScore: b.relevance_score,
          tags: b.tags,
          // file_extensions_to_index: null
          // last_indexed: "2020-02-06T19:32:00.168957+00:00"
          // scanner_parallel_shards_depth: null
          // skip_meta_data_indexing: false
          // sns_notification_arn: "arn:aws:sns:us-east-1:712023778557:quilt-kevin-stage-QuiltNotifications-8dfddc58-66e9-4cfd-9eb7-d1d0767420d1"
        })),
      ),
    ),
  key: () => null,
})
