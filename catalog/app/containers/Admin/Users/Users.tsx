import cx from 'classnames'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'

import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as Auth from 'containers/Auth'
import * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'
import * as validators from 'utils/validators'

import * as Form from '../Form'
import * as Table from '../Table'

import USERS_QUERY from './gql/Users.generated'
import USER_CREATE_MUTATION from './gql/UserCreate.generated'
import USER_DELETE_MUTATION from './gql/UserDelete.generated'
import USER_SET_EMAIL_MUTATION from './gql/UserSetEmail.generated'
import USER_SET_ROLES_MUTATION from './gql/UserSetRoles.generated'
import USER_SET_ACTIVE_MUTATION from './gql/UserSetActive.generated'
import USER_SET_ADMIN_MUTATION from './gql/UserSetAdmin.generated'

import { UserSelectionFragment as User } from './gql/UserSelection.generated'

type Role = GQL.DataForDoc<typeof USERS_QUERY>['roles'][number]

const DIALOG_PROPS: Dialogs.ExtraDialogProps = { maxWidth: 'xs', fullWidth: true }

const useMonoStyles = M.makeStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

interface MonoProps {
  className?: string
  children: React.ReactNode
}

function Mono({ className, children }: MonoProps) {
  const classes = useMonoStyles()
  return <span className={cx(className, classes.root)}>{children}</span>
}

const useInviteStyles = M.makeStyles({
  infoIcon: {
    fontSize: '1.25em',
    verticalAlign: '-3px',
  },
})

interface InviteProps {
  close: () => void
  roles: readonly Role[]
  defaultRoleName: string | undefined
}

function Invite({ close, roles, defaultRoleName }: InviteProps) {
  const classes = useInviteStyles()
  const create = GQL.useMutation(USER_CREATE_MUTATION)
  const { push } = Notifications.use()

  const onSubmit = React.useCallback(
    async ({ username, email, roleName }) => {
      // XXX: use formspec to convert/validate form values into gql input?
      const input = {
        name: username,
        email,
        roleName,
      }
      try {
        const data = await create({ input })
        const r = data.admin.user.create
        switch (r.__typename) {
          case 'User':
            close()
            push('User invited')
            return
          case 'OperationError':
            switch (r.name) {
              case 'SubscriptionInvalid':
                return { [FF.FORM_ERROR]: 'subscriptionInvalid' }
              case 'MailSendError':
                return { [FF.FORM_ERROR]: 'smtp' }
            }
            throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
          case 'InvalidInput':
            const errors: Record<string, string> = {}
            r.errors.forEach((e) => {
              switch (e.path) {
                case 'input.name':
                  errors.username = e.name === 'Conflict' ? 'taken' : 'invalid'
                  break
                case 'input.email':
                  errors.email = e.name === 'Conflict' ? 'taken' : 'invalid'
                  break
                default:
                  throw new Error(
                    `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
                  )
              }
            })
            return errors
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error creating user', input)
        // eslint-disable-next-line no-console
        console.dir(e)
        Sentry.captureException(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [create, push, close],
  )

  return (
    <RF.Form
      onSubmit={onSubmit}
      initialValues={{ roleName: defaultRoleName || roles[0].name }}
    >
      {({
        handleSubmit,
        submitting,
        submitError,
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
                validate={validators.required as FF.FieldValidator<any>}
                label="Username"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a username',
                  taken: 'Username already taken',
                  invalid: (
                    <>
                      Enter a valid username{' '}
                      <M.Tooltip
                        arrow
                        title="Must start with a letter or underscore, and contain only alphanumeric characters and underscores thereafter"
                      >
                        <M.Icon className={classes.infoIcon}>info</M.Icon>
                      </M.Tooltip>
                    </>
                  ),
                }}
                autoComplete="off"
              />
              <RF.Field
                component={Form.Field}
                name="email"
                validate={validators.required as FF.FieldValidator<any>}
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
                name="roleName"
                label="Role"
                select
                fullWidth
                margin="normal"
              >
                {roles.map((r) => (
                  <M.MenuItem value={r.name} key={r.id}>
                    {r.name}
                  </M.MenuItem>
                ))}
              </RF.Field>
              {(!!error || !!submitError) && (
                <Form.FormError
                  error={error || submitError}
                  errors={{
                    unexpected: 'Something went wrong',
                    smtp: 'SMTP error: contact your administrator',
                    subscriptionInvalid: 'Invalid subscription',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={close} color="primary" disabled={submitting}>
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

interface EditProps {
  close: () => void
  user: User
}

function Edit({ close, user: { email: oldEmail, name } }: EditProps) {
  const { push } = Notifications.use()
  const setEmail = GQL.useMutation(USER_SET_EMAIL_MUTATION)

  const onSubmit = React.useCallback(
    async ({ email }) => {
      if (email === oldEmail) {
        close()
        return
      }

      try {
        const data = await setEmail({ name, email })
        const r = data.admin.user.mutate?.setEmail
        switch (r?.__typename) {
          case 'User':
            close()
            push('Changes saved')
            return
          case undefined:
            throw new Error('User not found') // should not happend
          case 'OperationError':
            if (r.name === 'EmailAlreadyInUse') return { email: 'taken' }
            throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
          case 'InvalidInput':
            const [e] = r.errors
            if (e.path === 'input.email' && e.name === 'InvalidEmail') {
              return { email: 'invalid' }
            }
            throw new Error(
              `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
            )
          default:
            assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error changing email', { name, email })
        // eslint-disable-next-line no-console
        console.dir(e)
        Sentry.captureException(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [close, name, oldEmail, setEmail, push],
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
          <M.DialogTitle>Edit user: &quot;{name}&quot;</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="email"
                validate={validators.required as FF.FieldValidator<any>}
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
            <M.Button onClick={close} color="primary" disabled={submitting}>
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

function ActionProgress({ children }: React.PropsWithChildren<{}>) {
  return (
    <M.Typography
      variant="body2"
      color="textSecondary"
      style={{ marginLeft: '16px', flexGrow: 1 }}
    >
      {children}
    </M.Typography>
  )
}

interface DeleteProps {
  close: () => void
  name: string
}

function Delete({ name, close }: DeleteProps) {
  const { push } = Notifications.use()
  const del = GQL.useMutation(USER_DELETE_MUTATION)
  const onSubmit = React.useCallback(async () => {
    try {
      const data = await del({ name })
      const r = data.admin.user.mutate?.delete
      if (!r) return { [FF.FORM_ERROR]: 'notFound' }
      switch (r.__typename) {
        case 'Ok':
          close()
          push(`User "${name}" deleted`)
          return
        case 'InvalidInput':
          const [e] = r.errors
          throw new Error(
            `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
          )
        case 'OperationError':
          if (r.name === 'DeleteSelf') {
            return { [FF.FORM_ERROR]: 'deleteSelf' }
          }
          throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
        default:
          assertNever(r)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error deleting user')
      // eslint-disable-next-line no-console
      console.dir(e)
      Sentry.captureException(e)
      return { [FF.FORM_ERROR]: 'unexpected' }
    }
  }, [del, name, close, push])

  return (
    <RF.Form onSubmit={onSubmit}>
      {({ handleSubmit, submitting, submitError }) => (
        <>
          <M.DialogTitle>Delete a user</M.DialogTitle>
          <M.DialogContent>
            You are about to delete user &quot;{name}&quot;.
            <br />
            This operation is irreversible.
            <br />
            {!!submitError && (
              <Form.FormError
                error={submitError}
                errors={{
                  unexpected: 'Something went wrong',
                  notFound: 'User not found', // should not happen
                  deleteSelf: 'You cannot delete yourself', // should not happen
                }}
              />
            )}
          </M.DialogContent>
          <M.DialogActions>
            {submitting && <ActionProgress>Deleting...</ActionProgress>}
            <M.Button onClick={close} color="primary" disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button onClick={handleSubmit} color="primary" disabled={submitting}>
              Delete
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

interface ConfirmAdminRightsProps {
  admin: boolean
  name: string
  close: Dialogs.Close<boolean>
}

function ConfirmAdminRights({ name, admin, close }: ConfirmAdminRightsProps) {
  const { push } = Notifications.use()
  const setAdmin = GQL.useMutation(USER_SET_ADMIN_MUTATION)

  const doChange = React.useCallback(
    () =>
      close(
        setAdmin({ name, admin })
          .then((data) => {
            const r = data.admin.user.mutate?.setAdmin
            switch (r?.__typename) {
              case 'User':
                return true
              case undefined: // should not happen
                throw new Error('User not found')
              case 'InvalidInput': // should not happen
                const [e] = r.errors
                throw new Error(
                  `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
                )
              case 'OperationError': // should not happen
                throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
              default:
                assertNever(r)
            }
          })
          .catch((e) => {
            push(`Could not change admin status for user "${name}": ${e}`)
            // eslint-disable-next-line no-console
            console.error('Could not change user admin status', { name, admin })
            // eslint-disable-next-line no-console
            console.dir(e)
            throw e // revert value change in <Editable>
          }),
      ),
    [admin, close, name, setAdmin, push],
  )

  return (
    <>
      <M.DialogTitle>{admin ? 'Grant' : 'Revoke'} admin rights</M.DialogTitle>
      <M.DialogContent>
        You are about to {admin ? 'grant admin rights to' : 'revoke admin rights from'}{' '}
        &quot;{name}&quot;.
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close(false)} color="primary">
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

interface UsernameProps extends React.HTMLProps<HTMLSpanElement> {
  admin?: boolean
}

function Username({ className, admin = false, children, ...props }: UsernameProps) {
  const classes = useUsernameStyles()
  return (
    <span className={cx(className, classes.root)} {...props}>
      {admin && <M.Icon className={classes.icon}>security</M.Icon>}
      <Mono className={cx({ [classes.admin]: admin })}>{children}</Mono>
    </span>
  )
}

interface EditRolesProps {
  close: Dialogs.Close
  roles: readonly Role[]
  user: User
}

function EditRoles({ close, roles, user }: EditRolesProps) {
  const { push } = Notifications.use()
  const setRoles = GQL.useMutation(USER_SET_ROLES_MUTATION)

  const onSubmit = React.useCallback(
    async (values) => {
      // console.log('submit', values)
      // XXX: use formspec to convert/validate form values into gql input?
      const input = {
        name: user.name,
        roleNames: values.roles.map((r: Role) => r.name),
        activeRoleName: values.roles[0].name,
      }
      try {
        const data = await setRoles(input)
        const r = data.admin.user.mutate?.setRoles
        switch (r?.__typename) {
          case undefined:
            throw new Error('User not found') // should not happend
          case 'User':
            close()
            push('Changes saved')
            return
          case 'OperationError':
            // TODO
            throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
          case 'InvalidInput':
            // TODO
            const [e] = r.errors
            throw new Error(
              `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
            )
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error setting roles for user', input)
        // eslint-disable-next-line no-console
        console.dir(e)
        Sentry.captureException(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [push, close, setRoles, user.name],
  )

  const handleToggle = (selected: Role[], role: Role) =>
    selected.find((r) => r.id === role.id)
      ? selected.filter((r) => r.id !== role.id)
      : [...selected, role]

  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ roles: user.roles, role: user.role }}>
      {({
        handleSubmit,
        submitting,
        submitError,
        submitFailed,
        error,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
      }) => (
        <>
          <M.DialogTitle>Configure roles for {user.name}</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field<Role[]>
                name="roles"
                // validate={validators.required as FF.FieldValidator<any>}
                // errors={{
                //   required: 'Enter a username',
                //   taken: 'Username already taken',
                //   invalid: (
                //     <>
                //       Enter a valid username{' '}
                //       <M.Tooltip
                //         arrow
                //         title="Must start with a letter or underscore, and contain only alphanumeric characters and underscores thereafter"
                //       >
                //         <M.Icon className={classes.infoIcon}>info</M.Icon>
                //       </M.Tooltip>
                //     </>
                //   ),
                // }}
                // autoComplete="off"
              >
                {({ input: { onChange, value } }) => (
                  <M.List>
                    {roles.map((role) => (
                      <M.ListItem
                        key={role.id}
                        dense
                        button
                        onClick={() => onChange(handleToggle(value, role))}
                      >
                        <M.ListItemIcon>
                          <M.Checkbox
                            edge="start"
                            checked={!!value.find((r) => r.id === role.id)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </M.ListItemIcon>
                        <M.ListItemText primary={role.name} />
                      </M.ListItem>
                    ))}
                  </M.List>
                )}
              </RF.Field>
              {(!!error || !!submitError) && (
                <Form.FormError
                  error={error || submitError}
                  errors={{
                    unexpected: 'Something went wrong',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={close} color="primary" disabled={submitting}>
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

interface EditableRenderProps<T> {
  change: (v: T) => void
  busy: boolean
  value: T
}

interface EditableProps<T> {
  value: T
  onChange: (v: T) => void
  children: (props: EditableRenderProps<T>) => JSX.Element
}

function Editable<T>({ value, onChange, children }: EditableProps<T>) {
  const [busy, setBusy] = React.useState(false)
  const [savedValue, saveValue] = React.useState(value)
  const change = React.useCallback(
    (newValue: T) => {
      if (savedValue === newValue) return
      if (busy) return
      setBusy(true)
      saveValue(newValue)
      Promise.resolve(onChange(newValue))
        .catch(() => {
          saveValue(savedValue)
        })
        .finally(() => {
          setBusy(false)
        })
    },
    [onChange, busy, setBusy, savedValue, saveValue],
  )

  return children({ change, busy, value: savedValue })
}

function UsersSkeleton() {
  return (
    <M.Paper>
      <Table.Toolbar heading="Users" />
      <Table.Progress />
    </M.Paper>
  )
}

// not a valid role name
const emptyRole = '<None>'

interface ColumnDisplayProps {
  roles: readonly Role[]
  setActive: (name: string, active: boolean) => Promise<void>
  openDialog: Dialogs.Open
  isSelf: boolean
}

const columns: Table.Column<User>[] = [
  {
    id: 'isActive',
    label: 'Enabled',
    getValue: (u) => u.isActive,
    getDisplay: (v: boolean, u, { setActive, isSelf }: ColumnDisplayProps) =>
      isSelf ? (
        <M.Switch checked={v} disabled color="default" />
      ) : (
        <Editable value={v} onChange={(active) => setActive(u.name, active)}>
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
    getValue: (u) => u.name,
    getDisplay: (_name: string, u) => <Username admin={u.isAdmin}>{u.name}</Username>,
    props: { component: 'th', scope: 'row' },
  },
  {
    id: 'email',
    label: 'Email',
    getValue: (u) => u.email,
  },
  {
    id: 'role',
    label: 'Role',
    getValue: (u) => u.role?.name,
    getDisplay: (v: string | undefined, u, { roles, openDialog }: ColumnDisplayProps) => (
      <div
        onClick={() =>
          openDialog(({ close }) => <EditRoles {...{ close, roles, user: u }} />)
        }
      >
        {v ?? emptyRole}
        {u.roles.length > 1 && <span> +{u.roles.length - 1}</span>}
      </div>
    ),
  },
  {
    id: 'dateJoined',
    label: 'Date joined',
    getValue: (u) => u.dateJoined,
    getDisplay: (v: Date) => (
      <span title={v.toString()}>
        <Format.Relative value={v} />
      </span>
    ),
  },
  {
    id: 'lastLogin',
    label: 'Last login',
    getValue: (u) => u.lastLogin,
    getDisplay: (v: Date) => (
      <span title={v.toString()}>
        <Format.Relative value={v} />
      </span>
    ),
  },
  {
    id: 'isAdmin',
    label: 'Admin',
    hint: 'Admins can see this page, add/remove users, and make/remove admins',
    getValue: (u) => u.isAdmin,
    getDisplay: (v: boolean, { name }, { openDialog, isSelf }: ColumnDisplayProps) =>
      isSelf ? (
        <M.Switch checked={v} disabled color="default" />
      ) : (
        <Editable
          value={v}
          onChange={(admin) =>
            openDialog<boolean>(
              ({ close }) => <ConfirmAdminRights {...{ close, admin, name }} />,
              DIALOG_PROPS,
            ).then((res) => {
              if (!res) throw new Error('cancel')
            })
          }
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
]

function useSetActive() {
  const { push } = Notifications.use()
  const setActive = GQL.useMutation(USER_SET_ACTIVE_MUTATION)

  return React.useCallback(
    async (name: string, active: boolean) => {
      try {
        const data = await setActive({ name, active })
        const r = data.admin.user.mutate?.setActive
        switch (r?.__typename) {
          case 'User':
            return
          case undefined:
            throw new Error('User not found') // should not happend
          case 'OperationError':
            throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
          case 'InvalidInput':
            const [e] = r.errors
            throw new Error(
              `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
            )
          default:
            assertNever(r)
        }
      } catch (e) {
        push(`Could not ${active ? 'enable' : 'disable'} user "${name}": ${e}`)
        // eslint-disable-next-line no-console
        console.error('Error (de)activating user', { name, active })
        // eslint-disable-next-line no-console
        console.dir(e)
        Sentry.captureException(e)
        throw e
      }
    },
    [setActive, push],
  )
}

export default function Users() {
  const data = GQL.useQueryS(USERS_QUERY)
  const rows = data.admin.user.list
  const roles = data.roles
  const defaultRoleName = data.defaultRole?.name

  const openDialog = Dialogs.use()

  const setActive = useSetActive()

  const filtering = Table.useFiltering({
    rows,
    filterBy: ({ email, name }) => email + name,
  })
  const ordering = Table.useOrdering({
    rows: filtering.filtered,
    column: columns[0],
  })
  const pagination = Pagination.use(ordering.ordered, {
    getItemId: (u: User) => u.name,
  } as $TSFixMe)

  const toolbarActions = [
    {
      title: 'Invite',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        openDialog(
          ({ close }) => <Invite {...{ close, roles, defaultRoleName }} />,
          DIALOG_PROPS,
        )
      }, [roles, defaultRoleName, openDialog]),
    },
  ]

  const self: string = redux.useSelector(Auth.selectors.username)

  const inlineActions = (user: User) => [
    user.name === self
      ? null
      : {
          title: 'Delete',
          icon: <M.Icon>delete</M.Icon>,
          fn: () => {
            openDialog(
              ({ close }) => <Delete {...{ close, name: user.name }} />,
              DIALOG_PROPS,
            )
          },
        },
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: () => {
        openDialog(({ close }) => <Edit {...{ close, user }} />, DIALOG_PROPS)
      },
    },
  ]

  const getDisplayProps = (u: User): ColumnDisplayProps => ({
    setActive,
    roles,
    openDialog,
    isSelf: u.name === self,
  })

  return (
    <React.Suspense fallback={<UsersSkeleton />}>
      <M.Paper>
        <Table.Toolbar heading="Users" actions={toolbarActions}>
          <Table.Filter {...filtering} />
        </Table.Toolbar>
        <Table.Wrapper>
          <M.Table size="small">
            <Table.Head columns={columns} ordering={ordering} withInlineActions />
            <M.TableBody>
              {pagination.paginated.map((i: User) => (
                <M.TableRow hover key={i.name}>
                  {columns.map((col) => (
                    <M.TableCell key={col.id} {...col.props}>
                      {(col.getDisplay || R.identity)(
                        col.getValue(i),
                        i,
                        getDisplayProps(i),
                      )}
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
