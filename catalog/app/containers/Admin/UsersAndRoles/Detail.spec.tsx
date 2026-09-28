import * as React from 'react'
import { MemoryRouter, Route, Switch } from 'react-router-dom'
import { render } from '@testing-library/react'
import * as M from '@material-ui/core'
import { describe, expect, it, vi } from 'vitest'

import { adminRoleDetail, adminUserDetail, adminUsers } from 'constants/routes'
import * as style from 'constants/style'
import * as NamedRoutes from 'utils/NamedRoutes'

// `constants/config` reads window.QUILT_CATALOG_CONFIG at module load, so without
// this the suite fails to import at all. Same stub `Roles.spec` uses.
vi.mock('constants/config', () => ({ default: {} }))

const ROLE = { id: 'r-1', name: 'curators' }
const user = (name: string) => ({ name, email: name, role: ROLE, extraRoles: [] })
const USERS = [user('ernest@quilt.bio'), user('ops+eng@quilt.bio')]

vi.mock('utils/GraphQL', async (importOriginal) => {
  const usersQuery = (await import('./gql/Users.generated')).default
  return {
    ...(await importOriginal<typeof import('utils/GraphQL')>()),
    useQueryS: (doc: unknown) =>
      doc === usersQuery
        ? { admin: { user: { list: USERS } }, roles: [ROLE], defaultRole: ROLE }
        : {
            admin: { isDefaultRoleSettingDisabled: false },
            roles: [ROLE],
            defaultRole: ROLE,
          },
  }
})

vi.mock('react-redux', () => ({ useSelector: () => 'someone-else' }))

vi.mock('utils/Dialogs', () => ({
  use: () => ({ open: () => {}, render: () => null }),
}))

// The pages themselves render the permission tables, which need far more of the
// schema than the lookup under test; only the record they were handed matters here.
vi.mock('./UserPage', () => ({
  default: ({ user: u }: { user: { name: string } }) => <div>user:{u.name}</div>,
}))
vi.mock('./RolePage', () => ({
  default: ({ role }: { role: typeof ROLE }) => <div>role:{role.name}</div>,
}))

import { RoleDetail, UserDetail } from './Detail'

function mount(at: string) {
  return render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <MemoryRouter initialEntries={[at]}>
        <NamedRoutes.Provider routes={{ adminRoleDetail, adminUserDetail, adminUsers }}>
          <Switch>
            <Route path={adminUserDetail.path} exact strict>
              <UserDetail />
            </Route>
            <Route path={adminRoleDetail.path} exact strict>
              <RoleDetail />
            </Route>
          </Switch>
        </NamedRoutes.Provider>
      </MemoryRouter>
    </M.MuiThemeProvider>,
  )
}

describe('containers/Admin/UsersAndRoles/Detail', () => {
  // Mounted through the real builder: a hand-written path would not carry the
  // encoding the link does, which is the whole of what the param sees.
  it.each(USERS.map((u) => u.name))('finds the user the link points at: %s', (name) => {
    const { getByText } = mount(adminUserDetail.url(name))
    expect(getByText(`user:${name}`)).toBeTruthy()
  })

  it('names the missing user as the admin wrote it, not as the URL encodes it', () => {
    const { getByText } = mount(adminUserDetail.url('nobody@quilt.bio'))
    expect(getByText('No user named "nobody@quilt.bio".')).toBeTruthy()
  })

  it('finds the role the link points at', () => {
    const { getByText } = mount(adminRoleDetail.url(ROLE.id))
    expect(getByText(`role:${ROLE.name}`)).toBeTruthy()
  })

  it('reports a role it cannot find', () => {
    const { getByText } = mount(adminRoleDetail.url('r-missing'))
    expect(getByText(/No role with that id/)).toBeTruthy()
  })
})
