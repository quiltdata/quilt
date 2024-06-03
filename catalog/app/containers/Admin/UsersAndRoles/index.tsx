import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Policies from './Policies'
import Roles from './Roles'
import Users from './Users'

export default function UsersAndRoles() {
  return (
    <>
      <MetaTitle>{['Users, Roles and Policies', 'Admin']}</MetaTitle>
      <M.Box mt={2}>
        <Users />
      </M.Box>
      <M.Box mt={2}>
        <Roles />
      </M.Box>
      <M.Box mt={2}>
        <Policies />
      </M.Box>
      <M.Box pt={4} />
    </>
  )
}
