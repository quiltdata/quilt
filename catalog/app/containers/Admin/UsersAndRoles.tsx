import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

// XXX: move the components imported below into a single module
import { Roles, Policies } from './RolesAndPolicies'
import Users from './Users'

export default function UsersAndRoles() {
  return (
    <>
      <MetaTitle>{['Users, Roles and Policies', 'Admin']}</MetaTitle>
      <M.Box mt={2}>
        <Users />
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
