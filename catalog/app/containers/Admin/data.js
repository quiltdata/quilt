import * as R from 'ramda'

import * as Cache from 'utils/ResourceCache'

// TODO: remove after migrating this data to gql
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
