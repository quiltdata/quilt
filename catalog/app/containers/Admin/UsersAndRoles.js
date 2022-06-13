import * as React from 'react'
import * as M from '@material-ui/core'

import * as APIConnector from 'utils/APIConnector'
import MetaTitle from 'utils/MetaTitle'
import * as Cache from 'utils/ResourceCache'

import { Roles, Policies } from './RolesAndPolicies'
import Users from './Users'
import * as data from './data'

export default function UsersAndRoles() {
  const req = APIConnector.use()
  // TODO: use gql for querying users when implemented
  const users = Cache.useData(data.UsersResource, { req })
  return (
    <>
      <MetaTitle>{['Users, Roles and Policies', 'Admin']}</MetaTitle>
      <M.Box mt={2}>
        <Users users={users} />
      </M.Box>
      <M.Box mt={2} mb={2}>
        <Roles />
      </M.Box>
      <M.Box mt={2} mb={2}>
        <Policies />
      </M.Box>
    </>
  )
}
