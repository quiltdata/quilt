import cx from 'classnames'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import * as Format from 'utils/format'
import * as validators from 'utils/validators'

import * as Form from '../Form'
import * as Table from '../Table'
import * as data from '../data'

import ROLES_QUERY from './gql/Roles.generated'

const useMonoStyles = M.makeStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

function Mono({ className, children }) {
  const classes = useMonoStyles()
  return <span className={cx(className, classes.root)}>{children}</span>
}

// close: PT.func.isRequired,
// roles: PT.array.isRequired,
function Invite({ close, roles, defaultRoleId }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const onSubmit = React.useCallback(
    async ({ username, email, roleId }) => {
      const role = roles.find((r) => r.id === roleId)

      try {
        await req({
          endpoint: '/users/create',
          method: 'POST',
          body: JSON.stringify({ username, email }),
        })

        const user = {
          dateJoined: new Date(),
          email,
          isActive: true,
          isAdmin: false,
          lastLogin: new Date(),
          username,
        }

        try {
          await req({
            method: 'POST',
            endpoint: '/users/set_role',
            body: JSON.stringify({ username, role: role.name }),
          })
          user.roleId = role.id
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Error setting role', { username, role })
          // eslint-disable-next-line no-console
          console.dir(e)
        }

        cache.patchOk(data.UsersResource, null, R.append(user))
        push('User invited')
        close()
      } catch (e) {
        if (APIConnector.HTTPError.is(e, 400, /Username is not valid/)) {
          return {
            username: 'invalid',
          }
        }
        if (APIConnector.HTTPError.is(e, 409, /Username already taken/)) {
          return {
            username: 'taken',
          }
        }
        if (APIConnector.HTTPError.is(e, 400, /Invalid email/)) {
          return {
            email: 'invalid',
          }
        }
        if (APIConnector.HTTPError.is(e, 409, /Email already taken/)) {
          return {
            email: 'taken',
          }
        }
        if (APIConnector.HTTPError.is(e, 500, /SMTP.*invalid/)) {
          return {
            [FF.FORM_ERROR]: 'smtp',
          }
        }
        // eslint-disable-next-line no-console
        console.error('Error creating user')
        // eslint-disable-next-line no-console
        console.dir(e)
        return {
          [FF.FORM_ERROR]: 'unexpected',
        }
      }
    },
    [req, cache, push, close, roles],
  )

  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ roleId: defaultRoleId || roles[0].id }}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
      }) => (
        <>
          <M.DialogTitle>Invite a user</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="username"
                validate={validators.required}
                label="Username"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a username',
                  taken: 'Username already taken',
                  invalid: (
                    <span>
                      Enter a{' '}
                      <abbr title="Must start with a letter or underscore, and contain only alphanumeric characters and underscores thereafter">
                        valid
                      </abbr>{' '}
                      username
                    </span>
                  ),
                }}
                autoComplete="off"
              />
              <RF.Field
                component={Form.Field}
                name="email"
                validate={validators.required}
                label="Email"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter an email',
                  taken: 'Email already taken',
                  invalid: 'Enter a valid email',
                }}
                autoComplete="off"
              />
              <RF.Field
                component={Form.Field}
                name="roleId"
                label="Role"
                select
                fullWidth
                margin="normal"
              >
                {roles.map((r) => (
                  <M.MenuItem value={r.id} key={r.id}>
                    {r.name}
                  </M.MenuItem>
                ))}
              </RF.Field>
              {submitFailed && (
                <Form.FormError
                  error={error}
                  errors={{
                    unexpected: 'Something went wrong',
                    smtp: 'SMTP error: contact your administrator',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button
              onClick={() => close('cancel')}
              color="primary"
              disabled={submitting}
            >
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              disabled={
                submitting ||
                (hasValidationErrors && submitFailed) ||
                (hasSubmitErrors && !modifiedSinceLastSubmit)
              }
            >
              Invite
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

// close: PT.func.isRequired,
// user: PT.object.isRequired,
function Edit({ close, user: { email: oldEmail, username } }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()

  const onSubmit = React.useCallback(
    async ({ email }) => {
      if (email === oldEmail) {
        close()
        return
      }

      try {
        await req({
          endpoint: '/users/edit_email',
          method: 'POST',
          body: JSON.stringify({ username, email }),
        })

        cache.patchOk(
          data.UsersResource,
          null,
          R.map((u) => (u.username === username ? { ...u, email } : u)),
        )
        push('Changes saved')
        close()
      } catch (e) {
        if (APIConnector.HTTPError.is(e, 400, /Another user already has that email/)) {
          return {
            email: 'taken',
          }
        }
        if (APIConnector.HTTPError.is(e, 400, /Invalid email/)) {
          return {
            email: 'invalid',
          }
        }
        // eslint-disable-next-line no-console
        console.error('Error changing email')
        // eslint-disable-next-line no-console
        console.dir(e)
        return {
          [FF.FORM_ERROR]: 'unexpected',
        }
      }
    },
    [close, username, oldEmail, req, cache, push],
  )

  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ email: oldEmail }}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
      }) => (
        <>
          <M.DialogTitle>Edit user: &quot;{username}&quot;</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="email"
                validate={validators.required}
                label="Email"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter an email',
                  taken: 'Email already taken',
                  invalid: 'Enter a valid email',
                }}
                autoComplete="off"
              />
              {submitFailed && (
                <Form.FormError
                  error={error}
                  errors={{
                    unexpected: 'Something went wrong',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button
              onClick={() => close('cancel')}
              color="primary"
              disabled={submitting}
            >
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              disabled={
                submitting ||
                (hasValidationErrors && submitFailed) ||
                (hasSubmitErrors && !modifiedSinceLastSubmit)
              }
            >
              Save
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

// user: PT.object.isRequired,
// close: PT.func.isRequired,
function Delete({ user, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const doDelete = React.useCallback(() => {
    close()
    req({
      endpoint: '/users/delete',
      method: 'POST',
      body: JSON.stringify({ username: user.username }),
    })
      .then(() => {
        push(`User "${user.username}" deleted`)
      })
      .catch((e) => {
        // TODO: handle errors once the endpoint is working
        cache.patchOk(data.UsersResource, null, R.append(user))
        push(`Error deleting user "${user.username}"`)
        // eslint-disable-next-line no-console
        console.error('Error deleting user')
        // eslint-disable-next-line no-console
        console.dir(e)
      })
    // optimistically remove the user from cache
    cache.patchOk(data.UsersResource, null, R.reject(R.propEq('username', user.username)))
  }, [user, close, req, cache, push])

  return (
    <>
      <M.DialogTitle>Delete a user</M.DialogTitle>
      <M.DialogContent>
        You are about to delete user &quot;{user.username}&quot;. This operation is
        irreversible.
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={doDelete} color="primary">
          Delete
        </M.Button>
      </M.DialogActions>
    </>
  )
}

// admin: PT.bool.isRequired,
// username: PT.string.isRequired,
// close: PT.func.isRequired,
function AdminRights({ username, admin, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const doChange = React.useCallback(
    () =>
      close(
        req({
          method: 'POST',
          endpoint: `/users/${admin ? 'grant' : 'revoke'}_admin`,
          body: JSON.stringify({ username }),
        })
          .then(() => {
            cache.patchOk(
              data.UsersResource,
              null,
              R.map((u) => (u.username === username ? { ...u, isAdmin: admin } : u)),
            )
            return 'ok'
          })
          .catch((e) => {
            push(
              `Error ${admin ? 'granting' : 'revoking'} admin status for "${username}"`,
            )
            // eslint-disable-next-line no-console
            console.error('Error changing user admin status', { username, admin })
            // eslint-disable-next-line no-console
            console.dir(e)
            throw e
          }),
      ),
    [admin, close, username, req, cache, push],
  )

  return (
    <>
      <M.DialogTitle>{admin ? 'Grant' : 'Revoke'} admin rights</M.DialogTitle>
      <M.DialogContent>
        You are about to {admin ? 'grant admin rights to' : 'revoke admin rights from'}{' '}
        &quot;{username}&quot;.
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={doChange} color="primary">
          {admin ? 'Grant' : 'Revoke'}
        </M.Button>
      </M.DialogActions>
    </>
  )
}

const useUsernameStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  admin: {
    fontWeight: 600,
  },
  icon: {
    fontSize: '1em',
    marginLeft: `calc(-1em - ${t.spacing(0.5)}px)`,
    marginRight: t.spacing(0.5),
  },
}))

// admin: PT.bool,
function Username({ className, admin = false, children, ...props }) {
  const classes = useUsernameStyles()
  return (
    <span className={cx(className, classes.root)} {...props}>
      {admin && <M.Icon className={classes.icon}>security</M.Icon>}
      <Mono className={cx({ [classes.admin]: admin })}>{children}</Mono>
    </span>
  )
}

function Editable({ value, onChange, children }) {
  const [busy, setBusy] = React.useState(false)
  const [savedValue, saveValue] = React.useState(value)
  const change = React.useCallback(
    (newValue) => {
      if (savedValue === newValue) return
      if (busy) return
      setBusy(true)
      saveValue(newValue)
      Promise.resolve(onChange(newValue))
        .then(() => {
          setBusy(false)
        })
        .catch((e) => {
          saveValue(savedValue)
          setBusy(false)
          throw e
        })
    },
    [onChange, busy, setBusy, savedValue, saveValue],
  )

  return children({ change, busy, value: savedValue })
}

// not a valid role name
const emptyRole = '<None>'

function UsersSkeleton() {
  return (
    <M.Paper>
      <Table.Toolbar heading="Users" />
      <Table.Progress />
    </M.Paper>
  )
}

// users: PT.object.isRequired,
export default function Users({ users }) {
  const rows = Cache.suspend(users)
  const [
    {
      data: { roles, defaultRole },
    },
  ] = urql.useQuery({ query: ROLES_QUERY })
  const defaultRoleId = defaultRole?.id

  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const dialogs = Dialogs.use()
  const { open: openDialog } = dialogs

  const setRole = React.useCallback(
    (username, role) =>
      req({
        method: 'POST',
        endpoint: '/users/set_role',
        body: JSON.stringify({ username, role }),
      })
        .then(() => {
          cache.patchOk(
            data.UsersResource,
            null,
            R.map((u) => (u.username === username ? { ...u, role } : u)),
          )
        })
        .catch((e) => {
          push(`Error changing role for "${username}"`)
          // eslint-disable-next-line no-console
          console.error('Error chaging role', { username, role })
          // eslint-disable-next-line no-console
          console.dir(e)
          throw e
        }),
    [req, cache, push],
  )

  const setIsActive = React.useCallback(
    (username, active) =>
      req({
        method: 'POST',
        endpoint: `/users/${active ? 'enable' : 'disable'}`,
        body: JSON.stringify({ username }),
      })
        .then(() => {
          cache.patchOk(
            data.UsersResource,
            null,
            R.map((u) => (u.username === username ? { ...u, isActive: active } : u)),
          )
        })
        .catch((e) => {
          push(`Error ${active ? 'enabling' : 'disabling'} "${username}"`)
          // eslint-disable-next-line no-console
          console.error('Error (de)activating user', { username, active })
          // eslint-disable-next-line no-console
          console.dir(e)
          throw e
        }),
    [req, cache, push],
  )

  const columns = React.useMemo(
    () => [
      {
        id: 'isActive',
        label: 'Enabled',
        getValue: R.prop('isActive'),
        getDisplay: (v, u) => (
          <Editable value={v} onChange={(active) => setIsActive(u.username, active)}>
            {({ change, busy, value }) => (
              <M.Switch
                checked={value}
                onChange={(e) => change(e.target.checked)}
                disabled={busy}
                color="default"
              />
            )}
          </Editable>
        ),
      },
      {
        id: 'username',
        label: 'Username',
        getValue: R.prop('username'),
        getDisplay: (v, u) => <Username admin={u.isAdmin}>{v}</Username>,
        props: { component: 'th', scope: 'row' },
      },
      {
        id: 'email',
        label: 'Email',
        getValue: R.prop('email'),
      },
      {
        id: 'role',
        label: 'Role',
        getValue: (u) => u.roleId && (roles.find((r) => r.id === u.roleId) || {}).name,
        getDisplay: (v, u) => (
          <Editable value={v} onChange={(role) => setRole(u.username, role)}>
            {({ change, busy, value }) => (
              <M.Select
                value={value || emptyRole}
                onChange={(e) => change(e.target.value)}
                disabled={busy}
                renderValue={R.identity}
              >
                {roles.map((r) => (
                  <M.MenuItem value={r.name} key={r.id}>
                    {r.name}
                  </M.MenuItem>
                ))}
              </M.Select>
            )}
          </Editable>
        ),
      },
      {
        id: 'dateJoined',
        label: 'Date joined',
        getValue: R.prop('dateJoined'),
        getDisplay: (v) => (
          <span title={v.toString()}>
            <Format.Relative value={v} />
          </span>
        ),
      },
      {
        id: 'lastLogin',
        label: 'Last login',
        getValue: R.prop('lastLogin'),
        getDisplay: (v) => (
          <span title={v.toString()}>
            <Format.Relative value={v} />
          </span>
        ),
      },
      {
        id: 'isAdmin',
        label: 'Admin',
        hint: 'Admins can see this page, add/remove users, and make/remove admins',
        getValue: R.prop('isAdmin'),
        getDisplay: (v, u) => (
          <Editable
            value={v}
            onChange={async (admin) => {
              const res = await openDialog(({ close }) => (
                <AdminRights {...{ close, admin, username: u.username }} />
              ))
              if (res !== 'ok') throw new Error('cancelled')
            }}
          >
            {({ change, busy, value }) => (
              <M.Switch
                checked={value}
                onChange={(e) => change(e.target.checked)}
                disabled={busy}
                color="default"
              />
            )}
          </Editable>
        ),
      },
    ],
    [roles, openDialog, setIsActive, setRole],
  )

  const ordering = Table.useOrdering({ rows, column: columns[0] })
  const pagination = Pagination.use(ordering.ordered, {
    getItemId: R.prop('username'),
  })

  const toolbarActions = [
    {
      title: 'Invite',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        openDialog(({ close }) => <Invite {...{ close, roles, defaultRoleId }} />)
      }, [roles, defaultRoleId, openDialog]),
    },
  ]

  const inlineActions = (user) => [
    {
      title: 'Delete',
      icon: <M.Icon>delete</M.Icon>,
      fn: () => {
        dialogs.open(({ close }) => <Delete {...{ user, close }} />)
      },
    },
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: () => {
        dialogs.open(({ close }) => <Edit {...{ user, close }} />)
      },
    },
  ]

  return (
    <React.Suspense fallback={<UsersSkeleton />}>
      <M.Paper>
        {dialogs.render({ maxWidth: 'xs', fullWidth: true })}
        <Table.Toolbar heading="Users" actions={toolbarActions} />
        <Table.Wrapper>
          <M.Table size="small">
            <Table.Head columns={columns} ordering={ordering} withInlineActions />
            <M.TableBody>
              {pagination.paginated.map((i) => (
                <M.TableRow hover key={i.username}>
                  {columns.map((col) => (
                    <M.TableCell key={col.id} {...col.props}>
                      {(col.getDisplay || R.identity)(col.getValue(i), i)}
                    </M.TableCell>
                  ))}
                  <M.TableCell align="right" padding="none">
                    <Table.InlineActions actions={inlineActions(i)} />
                  </M.TableCell>
                </M.TableRow>
              ))}
            </M.TableBody>
          </M.Table>
        </Table.Wrapper>
        <Table.Pagination pagination={pagination} />
      </M.Paper>
    </React.Suspense>
  )
}
