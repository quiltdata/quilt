import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as Table from '../Table'

import Policies from './Policies'
import Roles from './Roles'
import Users from './Users'
import SuspenseWrapper from './SuspenseWrapper'
import { RoleDetail, UserDetail } from './Detail'

function ListPage() {
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

function DetailSkeleton() {
  return (
    <M.Box mt={2}>
      <Table.Progress />
    </M.Box>
  )
}

export default function UsersAndRoles() {
  const { paths } = NamedRoutes.use()
  return (
    <M.Box mb={2}>
      <RRDom.Switch>
        <RRDom.Route path={paths.adminUserDetail} exact strict>
          <MetaTitle>{['User', 'Admin']}</MetaTitle>
          <React.Suspense fallback={<DetailSkeleton />}>
            <UserDetail />
          </React.Suspense>
        </RRDom.Route>
        <RRDom.Route path={paths.adminRoleDetail} exact strict>
          <MetaTitle>{['Role', 'Admin']}</MetaTitle>
          <React.Suspense fallback={<DetailSkeleton />}>
            <RoleDetail />
          </React.Suspense>
        </RRDom.Route>
        <RRDom.Route>
          <ListPage />
        </RRDom.Route>
      </RRDom.Switch>
    </M.Box>
  )
}
