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
