import * as React from 'react'
import * as M from '@material-ui/core'

import * as APIConnector from 'utils/APIConnector'
import * as Cache from 'utils/ResourceCache'

import Roles from './Roles'
import Users from './Users'
import * as data from './data'

export default function UsersAndRoles() {
  const req = APIConnector.use()
  const users = Cache.useData(data.UsersResource, { req })
  const roles = Cache.useData(data.RolesResource, { req })
  return (
    <>
      <M.Box mt={2}>
        <Users users={users} roles={roles} />
      </M.Box>
      <M.Box mt={2} mb={2}>
        <Roles roles={roles} />
      </M.Box>
    </>
  )
}
