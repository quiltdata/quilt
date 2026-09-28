import * as React from 'react'
import * as redux from 'react-redux'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Auth from 'containers/Auth'
import * as Dialogs from 'utils/Dialogs'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'

import RolePage from './RolePage'
import UserPage from './UserPage'
import { Delete as DeleteRole, Edit as EditRole, SetDefault } from './Roles'
import { Delete as DeleteUser, EditEmail, EditRoles } from './Users'

import ROLES_QUERY from './gql/Roles.generated'
import USERS_QUERY from './gql/Users.generated'

// The route builders encode these params, but `history@4` decodeURI's the pathname
// before routing, so decoding one back is lossy. Re-encoding a candidate the same way
// avoids that. Two names can encode alike, so a verbatim match wins over one.
function findByParam<T>(items: readonly T[], param: string, id: (item: T) => string) {
  return (
    items.find((item) => id(item) === param) ??
    items.find((item) => decodeURI(encodeURIComponent(id(item))) === param)
  )
}

// Display only: nothing matched, so there is nothing to re-encode against. Decoding is
// lossy, so fall back to the param itself where it does not survive the round trip.
function readableParam(param: string) {
  try {
    const decoded = decodeURIComponent(param)
    return decodeURI(encodeURIComponent(decoded)) === param ? decoded : param
  } catch {
    return param
  }
}

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  back: {
    marginRight: t.spacing(2),
  },
}))

interface BackHeaderProps {
  back: () => void
  children: React.ReactNode
}

function BackHeader({ back, children }: BackHeaderProps) {
  const classes = useHeaderStyles()
  return (
    <div className={classes.root}>
      <M.IconButton className={classes.back} onClick={back} size="small">
        <M.Icon>arrow_back</M.Icon>
      </M.IconButton>
      <M.Typography variant="h5" color="textPrimary">
        {children}
      </M.Typography>
    </div>
  )
}

const useMissingStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
    padding: t.spacing(3),
  },
}))

function Missing({ children }: React.PropsWithChildren<{}>) {
  const classes = useMissingStyles()
  return (
    <M.Paper variant="outlined" className={classes.root}>
      <M.Typography>{children}</M.Typography>
    </M.Paper>
  )
}

export function UserDetail() {
  const { userName } = RRDom.useParams<{ userName: string }>()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const back = React.useCallback(() => history.push(urls.adminUsers()), [history, urls])

  const usersData = GQL.useQueryS(USERS_QUERY)
  // A user's own fragment carries only role ids and names, so the full records come
  // from the roles query; without them there is no way to read out what a role reaches.
  const rolesData = GQL.useQueryS(ROLES_QUERY)
  const self: string = redux.useSelector(Auth.selectors.username)
  const { open: openDialog, render: renderDialogs } = Dialogs.use()

  const user = findByParam(usersData.admin.user.list, userName, (u) => u.name)
  const rolesById = React.useMemo(
    () => new Map(rolesData.roles.map((r) => [r.id, r])),
    [rolesData.roles],
  )

  const onEditEmail = React.useCallback(() => {
    if (user) openDialog(({ close }) => <EditEmail close={close} user={user} />)
  }, [openDialog, user])

  const onEditRoles = React.useCallback(() => {
    if (user)
      openDialog(
        ({ close }) => (
          <EditRoles
            close={close}
            roles={usersData.roles}
            defaultRole={usersData.defaultRole}
            user={user}
          />
        ),
        { maxWidth: 'sm', fullWidth: true },
      )
  }, [openDialog, user, usersData.roles, usersData.defaultRole])

  const onDelete = React.useCallback(() => {
    if (user)
      openDialog(({ close }) => (
        <DeleteUser close={close} name={user.name} onDeleted={back} />
      ))
  }, [openDialog, user, back])

  return (
    <>
      {renderDialogs({ maxWidth: 'xs', fullWidth: true })}
      <BackHeader back={back}>User</BackHeader>
      {user ? (
        <UserPage
          user={user}
          isSelf={user.name === self}
          rolesById={rolesById}
          onEditEmail={onEditEmail}
          onEditRoles={onEditRoles}
          onDelete={onDelete}
        />
      ) : (
        <Missing>No user named &quot;{readableParam(userName)}&quot;.</Missing>
      )}
    </>
  )
}

export function RoleDetail() {
  const { roleId } = RRDom.useParams<{ roleId: string }>()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const back = React.useCallback(() => history.push(urls.adminUsers()), [history, urls])

  const rolesData = GQL.useQueryS(ROLES_QUERY)
  // Who holds the role: the roles query cannot answer it, only the user list can.
  const usersData = GQL.useQueryS(USERS_QUERY)
  const { open: openDialog, render: renderDialogs } = Dialogs.use()

  const role = findByParam(rolesData.roles, roleId, (r) => r.id)
  const holders = React.useMemo(
    () =>
      role
        ? usersData.admin.user.list.filter(
            (u) => u.role?.id === role.id || u.extraRoles.some((r) => r.id === role.id),
          )
        : [],
    [usersData.admin.user.list, role],
  )

  const onEdit = React.useCallback(() => {
    if (role) openDialog(({ close }) => <EditRole role={role} close={close} />)
  }, [openDialog, role])

  const onDelete = React.useCallback(() => {
    if (role)
      openDialog(({ close }) => <DeleteRole role={role} close={close} onDeleted={back} />)
  }, [openDialog, role, back])

  const onSetDefault = React.useCallback(() => {
    if (role) openDialog(({ close }) => <SetDefault role={role} close={close} />)
  }, [openDialog, role])

  return (
    <>
      {renderDialogs({ maxWidth: 'sm', fullWidth: true })}
      <BackHeader back={back}>Role</BackHeader>
      {role ? (
        <RolePage
          role={role}
          isDefault={role.id === rolesData.defaultRole?.id}
          holders={holders}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetDefault={
            rolesData.admin?.isDefaultRoleSettingDisabled ? undefined : onSetDefault
          }
        />
      ) : (
        <Missing>No role with that id.</Missing>
      )}
    </>
  )
}
