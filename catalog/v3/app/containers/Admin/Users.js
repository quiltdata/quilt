import cx from 'classnames'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedRelative } from 'react-intl'
import * as RC from 'recompose'
import * as RF from 'redux-form/immutable'
import Button from '@material-ui/core/Button'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import Icon from '@material-ui/core/Icon'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import Select from '@material-ui/core/Select'
import Switch from '@material-ui/core/Switch'
import MuiTable from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableRow from '@material-ui/core/TableRow'
import { withStyles } from '@material-ui/styles'

import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import * as RT from 'utils/reactTools'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'
import * as data from './data'

const Mono = withStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))(({ className, classes, ...props }) => (
  <span className={cx(className, classes.root)} {...props} />
))

const Invite = RT.composeComponent(
  'Admin.Users.Invite',
  RC.setPropTypes({
    close: PT.func.isRequired,
    roles: PT.array.isRequired,
  }),
  ({ close, roles }) => {
    const req = APIConnector.use()
    const cache = Cache.use()
    const { push } = Notifications.use()
    const onSubmit = React.useCallback(
      async (values) => {
        const { username, email, roleId } = values.toJS()
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
            throw new RF.SubmissionError({ username: 'invalid' })
          }
          if (APIConnector.HTTPError.is(e, 409, /Username already taken/)) {
            throw new RF.SubmissionError({ username: 'taken' })
          }
          if (APIConnector.HTTPError.is(e, 400, /Invalid email/)) {
            throw new RF.SubmissionError({ email: 'invalid' })
          }
          if (APIConnector.HTTPError.is(e, 409, /Email already taken/)) {
            throw new RF.SubmissionError({ email: 'taken' })
          }
          if (APIConnector.HTTPError.is(e, 500, /SMTP.*invalid/)) {
            throw new RF.SubmissionError({ _error: 'smtp' })
          }
          // eslint-disable-next-line no-console
          console.error('Error creating user')
          // eslint-disable-next-line no-console
          console.dir(e)
          throw new RF.SubmissionError({ _error: 'unexpected' })
        }
      },
      [req, cache, push, close, roles],
    )

    return (
      <Form.ReduxForm
        form="Admin.Users.Invite"
        onSubmit={onSubmit}
        initialValues={{ roleId: roles[0].id }}
      >
        {({ handleSubmit, submitting, submitFailed, error, invalid }) => (
          <React.Fragment>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <RF.Field
                  component={Form.Field}
                  name="username"
                  validate={[validators.required]}
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
                  validate={[validators.required]}
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
                    <MenuItem value={r.id} key={r.id}>
                      {r.name}
                    </MenuItem>
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
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => close('cancel')}
                color="primary"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                color="primary"
                disabled={submitting || (submitFailed && invalid)}
              >
                Invite
              </Button>
            </DialogActions>
          </React.Fragment>
        )}
      </Form.ReduxForm>
    )
  },
)

const Edit = RT.composeComponent(
  'Admin.Users.Edit',
  RC.setPropTypes({
    close: PT.func.isRequired,
    user: PT.object.isRequired,
  }),
  ({ close, user: { email: oldEmail, username } }) => {
    const req = APIConnector.use()
    const cache = Cache.use()
    const { push } = Notifications.use()

    const onSubmit = React.useCallback(
      async (values) => {
        const { email } = values.toJS()

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
            throw new RF.SubmissionError({ email: 'taken' })
          }
          if (APIConnector.HTTPError.is(e, 400, /Invalid email/)) {
            throw new RF.SubmissionError({ email: 'invalid' })
          }
          // eslint-disable-next-line no-console
          console.error('Error changing email')
          // eslint-disable-next-line no-console
          console.dir(e)
          throw new RF.SubmissionError({ _error: 'unexpected' })
        }
      },
      [close, username, req, cache, push],
    )

    return (
      <Form.ReduxForm
        form={`Admin.Users.Edit(${username})`}
        onSubmit={onSubmit}
        initialValues={{ email: oldEmail }}
      >
        {({ handleSubmit, submitting, submitFailed, error, invalid }) => (
          <React.Fragment>
            <DialogTitle>Edit user: &quot;{username}&quot;</DialogTitle>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <RF.Field
                  component={Form.Field}
                  name="email"
                  validate={[validators.required]}
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
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => close('cancel')}
                color="primary"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                color="primary"
                disabled={submitting || (submitFailed && invalid)}
              >
                Save
              </Button>
            </DialogActions>
          </React.Fragment>
        )}
      </Form.ReduxForm>
    )
  },
)

const Delete = RT.composeComponent(
  'Admin.Users.Delete',
  RC.setPropTypes({
    user: PT.object.isRequired,
    close: PT.func.isRequired,
  }),
  ({ user, close }) => {
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
      cache.patchOk(
        data.UsersResource,
        null,
        R.reject(R.propEq('username', user.username)),
      )
    }, [user, close, req, cache, push])

    return (
      <React.Fragment>
        <DialogTitle>Delete a user</DialogTitle>
        <DialogContent>
          You are about to delete user &quot;{user.username}&quot;. This operation is
          irreversible.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => close('cancel')} color="primary">
            Cancel
          </Button>
          <Button onClick={doDelete} color="primary">
            Delete
          </Button>
        </DialogActions>
      </React.Fragment>
    )
  },
)

const AdminRights = RT.composeComponent(
  'Admin.Users.AdminRights',
  RC.setPropTypes({
    admin: PT.bool.isRequired,
    username: PT.string.isRequired,
    close: PT.func.isRequired,
  }),
  ({ username, admin, close }) => {
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
      [req, cache, push],
    )

    return (
      <React.Fragment>
        <DialogTitle>{admin ? 'Grant' : 'Revoke'} admin rights</DialogTitle>
        <DialogContent>
          You are about to {admin ? 'grant admin rights to' : 'revoke admin rights from'}{' '}
          &quot;{username}&quot;.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => close('cancel')} color="primary">
            Cancel
          </Button>
          <Button onClick={doChange} color="primary">
            {admin ? 'Grant' : 'Revoke'}
          </Button>
        </DialogActions>
      </React.Fragment>
    )
  },
)

const Username = RT.composeComponent(
  'Admin.Users.Username',
  RC.setPropTypes({
    admin: PT.bool,
  }),
  withStyles((t) => ({
    root: {
      alignItems: 'center',
      display: 'flex',
    },
    admin: {
      fontWeight: 600,
    },
    icon: {
      fontSize: '1em',
      marginLeft: `calc(-1em - ${t.spacing.unit * 0.5}px)`,
      marginRight: t.spacing.unit * 0.5,
    },
  })),
  ({ className, classes, admin = false, children, ...props }) => (
    <span className={cx(className, classes.root)} {...props}>
      {admin && <Icon className={classes.icon}>security</Icon>}
      <Mono className={cx({ [classes.admin]: admin })}>{children}</Mono>
    </span>
  ),
)

const Editable = ({ value, onChange, children }) => {
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

export default RT.composeComponent(
  'Admin.Users',
  RC.setPropTypes({
    users: PT.object.isRequired,
    roles: PT.object.isRequired,
  }),
  RT.withSuspense(() => (
    <Paper>
      <Table.Toolbar heading="Users" />
      <Table.Progress />
    </Paper>
  )),
  ({ users, roles: rolesP }) => {
    const rows = Cache.suspend(users)
    const roles = Cache.suspend(rolesP)

    const req = APIConnector.use()
    const cache = Cache.use()
    const { push } = Notifications.use()

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
                <Switch
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
                <Select
                  value={value || emptyRole}
                  onChange={(e) => change(e.target.value)}
                  disabled={busy}
                  renderValue={R.identity}
                >
                  {roles.map((r) => (
                    <MenuItem value={r.name} key={r.id}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </Editable>
          ),
        },
        {
          id: 'dateJoined',
          label: 'Date joined',
          getValue: R.prop('dateJoined'),
          getDisplay: (v) => <FormattedRelative value={v} />,
        },
        {
          id: 'lastLogin',
          label: 'Last login',
          getValue: R.prop('lastLogin'),
          getDisplay: (v) => <FormattedRelative value={v} />,
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
                const res = await dialogs.open(({ close }) => (
                  <AdminRights {...{ close, admin, username: u.username }} />
                ))
                if (res !== 'ok') throw new Error('cancelled')
              }}
            >
              {({ change, busy, value }) => (
                <Switch
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
      [roles],
    )

    const ordering = Table.useOrdering({ rows, column: columns[0] })
    const pagination = Pagination.use(ordering.ordered, {
      getItemId: R.prop('username'),
    })
    const dialogs = Dialogs.use()

    const toolbarActions = [
      {
        title: 'Invite',
        icon: <Icon>add</Icon>,
        fn: React.useCallback(() => {
          dialogs.open(({ close }) => <Invite {...{ close, roles }} />)
        }, [dialogs.open]),
      },
    ]

    const inlineActions = (user) => [
      {
        title: 'Delete',
        icon: <Icon>delete</Icon>,
        fn: () => {
          dialogs.open(({ close }) => <Delete {...{ user, close }} />)
        },
      },
      {
        title: 'Edit',
        icon: <Icon>edit</Icon>,
        fn: () => {
          dialogs.open(({ close }) => <Edit {...{ user, close }} />)
        },
      },
    ]

    return (
      <Paper>
        {dialogs.render({ maxWidth: 'xs', fullWidth: true })}
        <Table.Toolbar heading="Users" actions={toolbarActions} />
        <Table.Wrapper>
          <MuiTable padding="dense">
            <Table.Head columns={columns} ordering={ordering} withInlineActions />
            <TableBody>
              {pagination.paginated.map((i) => (
                <TableRow hover key={i.username}>
                  {columns.map((col) => (
                    <TableCell key={col.id} {...col.props}>
                      {(col.getDisplay || R.identity)(col.getValue(i), i)}
                    </TableCell>
                  ))}
                  <TableCell align="right" padding="none">
                    <Table.InlineActions actions={inlineActions(i)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </MuiTable>
        </Table.Wrapper>
        <Table.Pagination pagination={pagination} />
      </Paper>
    )
  },
)
