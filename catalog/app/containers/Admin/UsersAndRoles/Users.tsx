import cx from 'classnames'
import * as FF from 'final-form'
import invariant from 'invariant'
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
import * as RoleSelect from './RoleSelect'

import USERS_QUERY from './gql/Users.generated'
import USER_CREATE_MUTATION from './gql/UserCreate.generated'
import USER_DELETE_MUTATION from './gql/UserDelete.generated'
import USER_SET_EMAIL_MUTATION from './gql/UserSetEmail.generated'
import USER_SET_ROLE_MUTATION from './gql/UserSetRole.generated'
import USER_SET_ACTIVE_MUTATION from './gql/UserSetActive.generated'
import USER_SET_ADMIN_MUTATION from './gql/UserSetAdmin.generated'

import { UserSelectionFragment as User } from './gql/UserSelection.generated'

type Role = GQL.DataForDoc<typeof USERS_QUERY>['roles'][number]

const DIALOG_PROPS: Dialogs.ExtraDialogProps = { maxWidth: 'xs', fullWidth: true }

const useDialogFormStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(-2),
  },
}))

function DialogForm({ className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  const classes = useDialogFormStyles()
  return <form className={cx(classes.root, className)} {...props} />
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
  defaultRole: Role | null
  isDefaultRoleSettingDisabled: boolean
}

function Invite({
  close,
  roles,
  defaultRole,
  isDefaultRoleSettingDisabled,
}: InviteProps) {
  const classes = useInviteStyles()
  const create = GQL.useMutation(USER_CREATE_MUTATION)
  const { push } = Notifications.use()

  interface FormValues {
    username: string
    email: string
    roles: RoleSelect.Value
  }

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      // XXX: use formspec to convert/validate form values into gql input?
      invariant(values.roles.active, 'No active role')
      const role = values.roles.active.name
      const extraRoles = values.roles.selected
        .map((r) => r.name)
        .filter((r) => r !== role)
      const input = {
        name: values.username,
        email: values.email,
        role,
        extraRoles,
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
    <RF.Form<FormValues>
      onSubmit={onSubmit}
      initialValues={{
        roles: {
          active: isDefaultRoleSettingDisabled ? null : defaultRole,
          selected: defaultRole && !isDefaultRoleSettingDisabled ? [defaultRole] : [],
        },
      }}
      initialValuesEqual={R.equals}
    >
      {({
        handleSubmit,
        submitting,
        submitFailed,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
      }) => (
        <>
          <M.DialogTitle>Invite a user</M.DialogTitle>
          <M.DialogContent>
            <DialogForm onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="username"
                validate={validators.required as FF.FieldValidator<any>}
                label="Username"
                placeholder="Enter a username"
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
                placeholder="Enter an email"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter an email',
                  taken: 'Email already taken',
                  invalid: 'Enter a valid email',
                }}
                autoComplete="off"
              />
              <M.Box mt={2} />
              <M.Typography variant="h6">Assign roles</M.Typography>
              <RF.Field<RoleSelect.Value> name="roles" validate={RoleSelect.validate}>
                {(props) => (
                  <RoleSelect.RoleSelect
                    roles={roles}
                    defaultRole={isDefaultRoleSettingDisabled ? null : defaultRole}
                    {...props}
                  />
                )}
              </RF.Field>
              <Form.FormErrorAuto>
                {{
                  unexpected: 'Something went wrong',
                  smtp: 'SMTP error: contact your administrator',
                  subscriptionInvalid: 'Invalid subscription',
                }}
              </Form.FormErrorAuto>
              <input type="submit" style={{ display: 'none' }} />
            </DialogForm>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={close} color="primary" disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              variant="contained"
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

interface EditEmailProps {
  close: () => void
  user: User
}

function EditEmail({ close, user: { email: oldEmail, name } }: EditEmailProps) {
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
            if (e.path === 'email' && e.name === 'InvalidEmail') {
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
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
      }) => (
        <>
          <M.DialogTitle>Edit email for user &quot;{name}&quot;</M.DialogTitle>
          <M.DialogContent>
            <DialogForm onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="email"
                validate={validators.required as FF.FieldValidator<any>}
                label="Email"
                placeholder="Enter an email"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter an email',
                  taken: 'Email already taken',
                  invalid: 'Enter a valid email',
                }}
                autoComplete="off"
              />
              <Form.FormErrorAuto>
                {{ unexpected: 'Something went wrong' }}
              </Form.FormErrorAuto>
              <input type="submit" style={{ display: 'none' }} />
            </DialogForm>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={close} color="primary" disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              variant="contained"
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
      {({ handleSubmit, submitting }) => (
        <>
          <M.DialogTitle>Delete a user</M.DialogTitle>
          <M.DialogContent>
            You are about to delete user &quot;{name}&quot;.
            <br />
            This operation is irreversible.
            <br />
            <Form.FormErrorAuto>
              {{
                unexpected: 'Something went wrong',
                notFound: 'User not found', // should not happen
                deleteSelf: 'You cannot delete yourself', // should not happen
              }}
            </Form.FormErrorAuto>
          </M.DialogContent>
          <M.DialogActions>
            {submitting && <ActionProgress>Deleting...</ActionProgress>}
            <M.Button onClick={close} color="primary" disabled={submitting}>
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              variant="contained"
              disabled={submitting}
            >
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
        user &quot;{name}&quot;.
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close(false)} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={doChange} color="primary" variant="contained">
          {admin ? 'Grant' : 'Revoke'}
        </M.Button>
      </M.DialogActions>
    </>
  )
}

const useHintStyles = M.makeStyles((t) => ({
  hint: {
    color: t.palette.text.hint,
    fontWeight: t.typography.fontWeightLight,
  },
}))

function Hint({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  const classes = useHintStyles()
  return <span className={cx(classes.hint, className)} {...props} />
}

const useClickableStyles = M.makeStyles((t) => ({
  clickable: {
    borderBottom: `1px dashed ${t.palette.text.hint}`,
    cursor: 'pointer',
  },
}))

const Clickable = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(function Clickable({ className, ...props }, ref) {
  const classes = useClickableStyles()
  return <span className={cx(classes.clickable, className)} {...props} ref={ref} />
})

const useUsernameStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  name: {
    maxWidth: '14rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  admin: {
    fontWeight: t.typography.fontWeightMedium,
  },
  self: {
    '&$name': {
      maxWidth: '12rem',
    },
  },
  icon: {
    fontSize: '1em',
    marginLeft: `calc(-1em - ${t.spacing(0.5)}px)`,
    marginRight: t.spacing(0.5),
  },
}))

interface UsernameDisplayProps {
  user: User
  self: boolean
}

function UsernameDisplay({ user, self }: UsernameDisplayProps) {
  const classes = useUsernameStyles()
  return (
    <span className={classes.root}>
      {user.isAdmin && <M.Icon className={classes.icon}>security</M.Icon>}
      <M.Tooltip title={user.name}>
        <span
          className={cx(
            classes.name,
            user.isAdmin && classes.admin,
            self && classes.self,
          )}
        >
          {user.name}
        </span>
      </M.Tooltip>
      {self && <Hint>&nbsp;(you)</Hint>}
    </span>
  )
}

interface EditRolesProps {
  close: Dialogs.Close
  roles: readonly Role[]
  defaultRole: Role | null
  user: User
}

function EditRoles({ close, roles, defaultRole, user }: EditRolesProps) {
  const { push } = Notifications.use()
  const setRole = GQL.useMutation(USER_SET_ROLE_MUTATION)

  interface FormValues {
    roles: RoleSelect.Value
  }

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      // XXX: use formspec to convert/validate form values into gql input?
      invariant(values.roles.active, 'No active role')
      const role = values.roles.active.name
      const extraRoles = values.roles.selected
        .map((r) => r.name)
        .filter((r) => r !== role)
      const vars = {
        name: user.name,
        role,
        extraRoles,
      }
      try {
        const data = await setRole(vars)
        const r = data.admin.user.mutate?.setRole
        switch (r?.__typename) {
          case undefined:
            throw new Error('User not found') // should not happend
          case 'User':
            close()
            push('Changes saved')
            return
          case 'OperationError':
            // should not happend
            throw new Error(`Unexpected operation error: [${r.name}] ${r.message}`)
          case 'InvalidInput':
            // should not happend
            const [e] = r.errors
            throw new Error(
              `Unexpected input error at '${e.path}': [${e.name}] ${e.message}`,
            )
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error setting roles for user', vars)
        // eslint-disable-next-line no-console
        console.dir(e)
        Sentry.captureException(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [push, close, setRole, user.name],
  )

  const selected = React.useMemo(
    () => user.extraRoles.concat(user.role ?? []).sort(RoleSelect.ROLE_NAME_ASC),
    [user.extraRoles, user.role],
  )

  return (
    <RF.Form<FormValues>
      onSubmit={onSubmit}
      initialValues={{ roles: { active: user.role, selected } }}
      initialValuesEqual={R.equals}
    >
      {({
        form,
        handleSubmit,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
        pristine,
        submitFailed,
        submitting,
      }) => (
        <>
          <M.DialogTitle>
            {user.isRoleAssignmentDisabled
              ? `Roles assigned to "${user.name}"`
              : `Assign roles to "${user.name}"`}
          </M.DialogTitle>
          <M.DialogContent>
            <DialogForm onSubmit={handleSubmit}>
              <RF.Field<RoleSelect.Value> name="roles" validate={RoleSelect.validate}>
                {(props) => (
                  <RoleSelect.RoleSelect
                    roles={roles}
                    defaultRole={defaultRole}
                    nonAssignable={user.isRoleAssignmentDisabled}
                    nonAssignableReason={user.isService ? 'service' : 'sso'}
                    {...props}
                  />
                )}
              </RF.Field>
              <Form.FormErrorAuto>
                {{ unexpected: 'Something went wrong' }}
              </Form.FormErrorAuto>
            </DialogForm>
          </M.DialogContent>
          {user.isRoleAssignmentDisabled ? (
            <M.DialogActions>
              <M.Button color="primary" onClick={close} variant="contained">
                Close
              </M.Button>
            </M.DialogActions>
          ) : (
            <M.DialogActions>
              <M.Button
                onClick={() => form.reset()}
                color="primary"
                disabled={pristine || submitting}
              >
                Reset
              </M.Button>
              <M.Button onClick={close} color="primary" disabled={submitting}>
                Cancel
              </M.Button>
              <M.Button
                onClick={handleSubmit}
                color="primary"
                variant="contained"
                disabled={
                  submitting ||
                  (hasValidationErrors && submitFailed) ||
                  (hasSubmitErrors && !modifiedSinceLastSubmit)
                }
              >
                Save
              </M.Button>
            </M.DialogActions>
          )}
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

  // A bulk action changes the row without going through `change`, so the optimistic
  // value has to follow the prop or the switch keeps showing the pre-action state.
  // Skipped while busy: mid-flight, the optimistic value is the truthful one.
  React.useEffect(() => {
    if (!busy) saveValue(value)
  }, [value, busy])
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

const useEditableStyles = M.makeStyles((t) => ({
  root: {
    marginLeft: t.spacing(0.5),
  },
}))

interface EditableSwitchProps {
  disabled?: boolean
  checked: boolean
  onChange: (v: boolean) => void
  hint: NonNullable<React.ReactNode>
}

function EditableSwitch({
  disabled = false,
  checked,
  onChange,
  hint,
}: EditableSwitchProps) {
  const classes = useEditableStyles()
  return disabled ? (
    <M.Switch className={classes.root} checked={checked} disabled color="default" />
  ) : (
    <Editable value={checked} onChange={onChange}>
      {({ change, busy, value }) => (
        <M.Tooltip title={hint}>
          <M.Switch
            className={classes.root}
            checked={value}
            onChange={(e) => change(e.target.checked)}
            disabled={busy}
            color="default"
          />
        </M.Tooltip>
      )}
    </Editable>
  )
}

interface EmailDisplayProps {
  user: User
  openDialog: Dialogs.Open
}

function EmailDisplay({ user, openDialog }: EmailDisplayProps) {
  // setEmail is refused for service users, and no server-computed flag covers it.
  if (user.isService) return <>{user.email}</>

  const edit = () =>
    openDialog(({ close }) => <EditEmail {...{ close, user }} />, DIALOG_PROPS)

  return (
    <M.Tooltip title="Click to edit">
      <Clickable onClick={edit}>{user.email}</Clickable>
    </M.Tooltip>
  )
}

// not a valid role name
const emptyRole = '<None>'

interface RoleDisplayProps {
  user: User
  roles: readonly Role[]
  defaultRole: Role | null
  openDialog: Dialogs.Open
}

function RoleDisplay({ user, roles, defaultRole, openDialog }: RoleDisplayProps) {
  const edit = () =>
    openDialog(({ close }) => <EditRoles {...{ close, roles, defaultRole, user }} />, {
      maxWidth: 'sm',
      fullWidth: true,
    })

  return (
    <M.Tooltip title={user.isRoleAssignmentDisabled ? 'Click to view' : 'Click to edit'}>
      <Clickable onClick={edit}>
        {user.role?.name ?? emptyRole}
        {user.extraRoles.length > 0 && <Hint> +{user.extraRoles.length}</Hint>}
      </Clickable>
    </M.Tooltip>
  )
}

function DateDisplay({ value }: { value: Date }) {
  return (
    <M.Tooltip title={value.toString()}>
      <span>
        <Format.Relative value={value} />
      </span>
    </M.Tooltip>
  )
}

interface ColumnDisplayProps {
  roles: readonly Role[]
  defaultRole: Role | null
  setActive: (name: string, active: boolean) => Promise<void>
  openDialog: Dialogs.Open
  isSelf: boolean
}

const columns: Table.Column<User>[] = [
  {
    id: 'isActive',
    label: 'Enabled',
    getValue: (u) => u.isActive,
    getDisplay: (_v, u, { setActive, isSelf }: ColumnDisplayProps) => (
      <EditableSwitch
        hint="Deactivated users can't sign in and use the Catalog"
        disabled={isSelf || u.isService}
        checked={u.isActive}
        onChange={(active) => setActive(u.name, active)}
      />
    ),
    props: { padding: 'none' },
  },
  {
    id: 'username',
    label: 'Username',
    getValue: (u) => u.name,
    getDisplay: (_v, u, { isSelf }: ColumnDisplayProps) => (
      <UsernameDisplay user={u} self={isSelf} />
    ),
    props: { component: 'th', scope: 'row' },
  },
  {
    id: 'email',
    label: 'Email',
    getValue: (u) => u.email,
    getDisplay: (_v, u, { openDialog }: ColumnDisplayProps) => (
      <EmailDisplay user={u} openDialog={openDialog} />
    ),
  },
  {
    id: 'role',
    label: 'Role',
    getValue: (u) => u.role?.name,
    getDisplay: (_v, u, { roles, defaultRole, openDialog }: ColumnDisplayProps) => (
      <RoleDisplay
        user={u}
        roles={roles}
        defaultRole={defaultRole}
        openDialog={openDialog}
      />
    ),
  },
  {
    id: 'dateJoined',
    label: 'Date joined',
    getValue: (u) => u.dateJoined,
    getDisplay: (_v, u) => <DateDisplay value={u.dateJoined} />,
  },
  {
    id: 'lastLogin',
    label: 'Last login',
    getValue: (u) => u.lastLogin,
    getDisplay: (_v, u) => <DateDisplay value={u.lastLogin} />,
  },
  {
    id: 'isAdmin',
    label: 'Admin',
    getValue: (u) => u.isAdmin,
    getDisplay: (_v, u, { openDialog, isSelf }: ColumnDisplayProps) => (
      <EditableSwitch
        hint="Admins can see this page, add/remove users, and make/remove admins"
        disabled={isSelf || u.isAdminAssignmentDisabled}
        checked={u.isAdmin}
        onChange={(admin) =>
          openDialog<boolean>(
            ({ close }) => <ConfirmAdminRights {...{ close, admin, name: u.name }} />,
            DIALOG_PROPS,
          ).then((res) => {
            if (!res) throw new Error('cancel')
          })
        }
      />
    ),
    props: { padding: 'none' },
  },
]

const getUserName = (u: User) => u.name

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

type BulkOutcome =
  | { status: 'ok' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

interface InputErrorLike {
  readonly path: string | null
  readonly message: string
  readonly name: string
}

type UserResultLike =
  | { readonly __typename: 'User' }
  | {
      readonly __typename: 'InvalidInput'
      readonly errors: ReadonlyArray<InputErrorLike>
    }
  | {
      readonly __typename: 'OperationError'
      readonly name: string
      readonly message: string
    }

type DeleteResultLike =
  | { readonly __typename: 'Ok' }
  | {
      readonly __typename: 'InvalidInput'
      readonly errors: ReadonlyArray<InputErrorLike>
    }
  | {
      readonly __typename: 'OperationError'
      readonly name: string
      readonly message: string
    }

const describeInputError = (e: InputErrorLike) => `${e.name} at '${e.path}': ${e.message}`

// Same union arms the per-user handlers narrow, but reported instead of thrown: a
// bulk run must survive one user's failure to report on the rest.
function outcomeFromUserResult(r: UserResultLike | null | undefined): BulkOutcome {
  switch (r?.__typename) {
    case 'User':
      return { status: 'ok' }
    case undefined:
      return { status: 'failed', reason: 'User not found' }
    case 'OperationError':
      return { status: 'failed', reason: `${r.name}: ${r.message}` }
    case 'InvalidInput':
      return { status: 'failed', reason: describeInputError(r.errors[0]) }
    default:
      return assertNever(r)
  }
}

function outcomeFromDeleteResult(r: DeleteResultLike | null | undefined): BulkOutcome {
  switch (r?.__typename) {
    case 'Ok':
      return { status: 'ok' }
    case undefined:
      return { status: 'failed', reason: 'User not found' }
    case 'OperationError':
      return { status: 'failed', reason: `${r.name}: ${r.message}` }
    case 'InvalidInput':
      return { status: 'failed', reason: describeInputError(r.errors[0]) }
    default:
      return assertNever(r)
  }
}

interface BulkOp {
  title: string
  icon: string
  /** Non-null reason means the user is left out of the run. */
  blockedReason: (u: User) => string | null
  prompt: (count: number) => string
  confirmLabel: string
  run: (u: User) => Promise<BulkOutcome>
}

function useBulkOps(self: string): BulkOp[] {
  const setActive = GQL.useMutation(USER_SET_ACTIVE_MUTATION)
  const setAdmin = GQL.useMutation(USER_SET_ADMIN_MUTATION)
  const del = GQL.useMutation(USER_DELETE_MUTATION)

  return React.useMemo(() => {
    const guard =
      (extra: (u: User) => string | null) =>
      (u: User): string | null =>
        u.name === self ? 'This is you' : extra(u)

    const attempt = async (
      run: () => Promise<BulkOutcome>,
      context: Record<string, unknown>,
    ): Promise<BulkOutcome> => {
      try {
        return await run()
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Bulk user operation failed', context)
        // eslint-disable-next-line no-console
        console.dir(e)
        Sentry.captureException(e)
        return { status: 'failed', reason: `${e}` }
      }
    }

    const activeOp = (active: boolean): BulkOp => ({
      title: active ? 'Enable' : 'Disable',
      icon: active ? 'check_circle' : 'block',
      blockedReason: guard((u) => (u.isService ? 'Service user' : null)),
      prompt: (n) => `${active ? 'Enable' : 'Disable'} ${n} user${n === 1 ? '' : 's'}?`,
      confirmLabel: active ? 'Enable' : 'Disable',
      run: (u) =>
        attempt(
          async () => {
            const data = await setActive({ name: u.name, active })
            return outcomeFromUserResult(data.admin.user.mutate?.setActive)
          },
          { name: u.name, active },
        ),
    })

    const adminOp = (admin: boolean): BulkOp => ({
      title: admin ? 'Grant admin rights' : 'Revoke admin rights',
      icon: admin ? 'verified_user' : 'remove_circle_outline',
      blockedReason: guard((u) =>
        u.isAdminAssignmentDisabled ? 'Admin rights not assignable' : null,
      ),
      prompt: (n) =>
        `${admin ? 'Grant admin rights to' : 'Revoke admin rights from'} ${n} user${
          n === 1 ? '' : 's'
        }?`,
      confirmLabel: admin ? 'Grant' : 'Revoke',
      run: (u) =>
        attempt(
          async () => {
            const data = await setAdmin({ name: u.name, admin })
            return outcomeFromUserResult(data.admin.user.mutate?.setAdmin)
          },
          { name: u.name, admin },
        ),
    })

    return [
      activeOp(true),
      activeOp(false),
      adminOp(true),
      adminOp(false),
      {
        title: 'Delete',
        icon: 'delete',
        blockedReason: guard((u) => (u.isService ? 'Service user' : null)),
        prompt: (n) =>
          `Delete ${n} user${n === 1 ? '' : 's'}? This operation is irreversible.`,
        confirmLabel: 'Delete',
        run: (u) =>
          attempt(
            async () => {
              const data = await del({ name: u.name })
              return outcomeFromDeleteResult(data.admin.user.mutate?.delete)
            },
            { name: u.name },
          ),
      },
    ]
  }, [self, setActive, setAdmin, del])
}

const useOutcomeStyles = M.makeStyles((t) => ({
  list: {
    maxHeight: 320,
    overflowY: 'auto',
  },
  ok: {
    color: t.palette.success.main,
  },
  failed: {
    color: t.palette.error.main,
  },
  skipped: {
    color: t.palette.text.secondary,
  },
}))

const OUTCOME_ICON: Record<BulkOutcome['status'], string> = {
  ok: 'check',
  failed: 'error_outline',
  skipped: 'remove',
}

interface OutcomeListProps {
  entries: [User, BulkOutcome][]
}

function OutcomeList({ entries }: OutcomeListProps) {
  const classes = useOutcomeStyles()
  return (
    <M.List dense disablePadding className={classes.list}>
      {entries.map(([u, outcome]) => (
        <M.ListItem key={u.name} disableGutters>
          <M.ListItemIcon className={classes[outcome.status]}>
            <M.Icon fontSize="small">{OUTCOME_ICON[outcome.status]}</M.Icon>
          </M.ListItemIcon>
          <M.ListItemText
            primary={u.name}
            secondary={outcome.status === 'ok' ? 'Done' : outcome.reason}
          />
        </M.ListItem>
      ))}
    </M.List>
  )
}

interface BulkActionProps {
  close: Dialogs.Close<boolean>
  op: BulkOp
  users: User[]
}

function BulkAction({ close, op, users }: BulkActionProps) {
  const [results, setResults] = React.useState<[User, BulkOutcome][] | null>(null)
  const [running, setRunning] = React.useState(false)

  const blocked = React.useMemo(
    () =>
      users
        .map((u) => [u, op.blockedReason(u)] as const)
        .filter((e): e is readonly [User, string] => e[1] !== null),
    [users, op],
  )
  const eligible = React.useMemo(
    () => users.filter((u) => op.blockedReason(u) === null),
    [users, op],
  )

  const run = React.useCallback(async () => {
    setRunning(true)
    const collected: [User, BulkOutcome][] = blocked.map(([u, reason]) => [
      u,
      { status: 'skipped', reason },
    ])
    // Sequential, and each outcome kept: these are N independent mutations, not one
    // transaction, so a failure part-way must still leave a verdict for every user.
    for (const u of eligible) {
      collected.push([u, await op.run(u)])
    }
    setResults(collected)
    setRunning(false)
  }, [blocked, eligible, op])

  if (results) {
    const failed = results.filter((e) => e[1].status === 'failed').length
    const done = results.filter((e) => e[1].status === 'ok').length
    return (
      <>
        <M.DialogTitle>{op.title}: results</M.DialogTitle>
        <M.DialogContent>
          <M.Typography variant="body2" color="textSecondary" gutterBottom>
            {done} succeeded, {failed} failed, {results.length - done - failed} skipped.
          </M.Typography>
          <OutcomeList entries={results} />
        </M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={() => close(true)} color="primary" variant="contained">
            Close
          </M.Button>
        </M.DialogActions>
      </>
    )
  }

  return (
    <>
      <M.DialogTitle>{op.title}</M.DialogTitle>
      <M.DialogContent>
        <M.Typography variant="body2" gutterBottom>
          {eligible.length > 0
            ? op.prompt(eligible.length)
            : `No selected user can be affected by "${op.title}".`}
        </M.Typography>
        {eligible.length > 0 && (
          <M.Typography variant="body2" color="textSecondary">
            {eligible.map((u) => u.name).join(', ')}
          </M.Typography>
        )}
        {blocked.length > 0 && (
          <>
            <M.Box mt={2} />
            <M.Typography variant="body2" color="textSecondary">
              Skipped: {blocked.map(([u, reason]) => `${u.name} (${reason})`).join(', ')}
            </M.Typography>
          </>
        )}
      </M.DialogContent>
      <M.DialogActions>
        {running && <ActionProgress>Working...</ActionProgress>}
        <M.Button onClick={() => close(false)} color="primary" disabled={running}>
          Cancel
        </M.Button>
        <M.Button
          onClick={run}
          color="primary"
          variant="contained"
          disabled={running || eligible.length === 0}
        >
          {op.confirmLabel}
        </M.Button>
      </M.DialogActions>
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  table: {
    '& th, & td': {
      whiteSpace: 'nowrap',
    },
    '& tbody th, & tbody td': {
      paddingRight: t.spacing(1),
    },
  },
}))

export default function Users() {
  const classes = useStyles()

  const data = GQL.useQueryS(USERS_QUERY)
  const rows = data.admin.user.list
  const isDefaultRoleSettingDisabled = data.admin.isDefaultRoleSettingDisabled
  const { roles, defaultRole } = data

  const openDialog = Dialogs.use()

  const setActive = useSetActive()

  const filtering = Table.useFiltering({
    rows,
    filterBy: ({ email, name }) => email + name,
  })
  const ordering = Table.useOrdering({
    rows: filtering.filtered,
    column: columns[1],
  })
  const pagination = Pagination.use(ordering.ordered, {
    getItemId: (u: User) => u.name,
  })

  const selection = Table.useSelection({
    rows: pagination.paginated,
    getId: getUserName,
  })

  const toolbarActions = [
    {
      title: 'Invite',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        openDialog(
          ({ close }) => (
            <Invite {...{ close, roles, defaultRole, isDefaultRoleSettingDisabled }} />
          ),
          {
            ...DIALOG_PROPS,
            maxWidth: 'sm',
          },
        )
      }, [roles, defaultRole, openDialog, isDefaultRoleSettingDisabled]),
    },
  ]

  const self: string = redux.useSelector(Auth.selectors.username)

  const bulkOps = useBulkOps(self)

  const { selectedRows, clear: clearSelection } = selection
  const selectedActions: Table.Action[] = React.useMemo(
    () =>
      bulkOps.map((op) => ({
        title: op.title,
        icon: <M.Icon>{op.icon}</M.Icon>,
        fn: () =>
          openDialog<boolean>(
            ({ close }) => <BulkAction {...{ close, op, users: selectedRows }} />,
            // Not dismissible: the run keeps going after the dialog unmounts, so a
            // stray Escape would leave an irreversible action with no record of which
            // users it reached.
            {
              ...DIALOG_PROPS,
              maxWidth: 'sm',
              disableBackdropClick: true,
              disableEscapeKeyDown: true,
            },
            // Only the results path has acted on the selection; cancelling keeps it.
          ).then((ran) => {
            if (ran) clearSelection()
          }),
      })),
    [bulkOps, openDialog, selectedRows, clearSelection],
  )

  const inlineActions = (user: User) => [
    user.name === self || user.isService
      ? null
      : {
          title: 'Delete',
          icon: <M.Icon>delete</M.Icon>,
          fn: () =>
            openDialog(
              ({ close }) => <Delete {...{ close, name: user.name }} />,
              DIALOG_PROPS,
            ),
        },
  ]

  const getDisplayProps = (u: User): ColumnDisplayProps => ({
    setActive,
    roles,
    defaultRole,
    openDialog,
    isSelf: u.name === self,
  })

  return (
    <>
      <Table.Toolbar
        heading="Users"
        actions={toolbarActions}
        selected={selection.count}
        selectedActions={selectedActions}
      >
        <Table.Filter {...filtering} />
      </Table.Toolbar>
      <Table.Wrapper>
        <M.Table size="small" className={classes.table}>
          <Table.Head
            columns={columns}
            ordering={ordering}
            selection={selection}
            withInlineActions
          />
          <M.TableBody>
            {pagination.paginated.map((i: User) => (
              <M.TableRow hover key={i.name} selected={selection.isSelected(i.name)}>
                <M.TableCell padding="checkbox">
                  <M.Checkbox
                    checked={selection.isSelected(i.name)}
                    onChange={() => selection.toggle(i.name)}
                    inputProps={{ 'aria-label': `Select user ${i.name}` }}
                  />
                </M.TableCell>
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
    </>
  )
}
