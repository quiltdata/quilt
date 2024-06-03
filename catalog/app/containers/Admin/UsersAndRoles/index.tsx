import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Policies from './Policies'
import Roles from './Roles'
import Users from './Users'
import SuspenseWrapper from './SuspenseWrapper'

export default function UsersAndRoles() {
  return (
    <>
      <MetaTitle>{['Users, Roles and Policies', 'Admin']}</MetaTitle>
      <M.Box mt={2}>
        <SuspenseWrapper heading="Users">
          <Users />
        </SuspenseWrapper>
      </M.Box>
      <M.Box mt={2}>
        <SuspenseWrapper heading="Roles">
          <Roles />
        </SuspenseWrapper>
      </M.Box>
      <M.Box mt={2}>
        <SuspenseWrapper heading="Policies">
          <Policies />
        </SuspenseWrapper>
      </M.Box>
      <M.Box pt={4} />
    </>
  )
}
