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

interface RoleSelectValue {
  selected: readonly Role[]
  active: Role | null | undefined
}

const ROLE_SELECT_VALUE_EMPTY: RoleSelectValue = { selected: [], active: undefined }

const validateRoleSelect: FF.FieldValidator<RoleSelectValue> = (v) =>
  v.active ? undefined : 'required'

const ROLE_NAME_ASC = R.ascend((r: Role) => r.name)

const useRoleSelectStyles = M.makeStyles((t) => ({
  root: {},
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: t.spacing(2.5),
  },
  chip: {
    marginRight: t.spacing(0.5),
    marginTop: t.spacing(0.5),
  },
  addIcon: {
    transform: 'rotate(45deg)',
  },
}))

interface RoleSelectProps extends RF.FieldRenderProps<RoleSelectValue> {
  roles: readonly Role[]
  label?: React.ReactNode
}

function RoleSelect({ roles, input: { value, onChange }, meta, label }: RoleSelectProps) {
  const classes = useRoleSelectStyles()

  const error = meta.submitFailed && meta.error
  const disabled = meta.submitting || meta.submitSucceeded

  const { active, selected } = value ?? ROLE_SELECT_VALUE_EMPTY

  const available = React.useMemo(
    () => roles.filter((r) => !selected.find((r2) => r2.id === r.id)).sort(ROLE_NAME_ASC),
    [roles, selected],
  )

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const openAddMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget)
    },
    [setAnchorEl],
  )

  const closeAddMenu = React.useCallback(() => {
    setAnchorEl(null)
  }, [])

  const add = (r: Role) =>
    onChange({
      selected: selected.concat(r).sort(ROLE_NAME_ASC),
      active: active ?? r,
    })

  const remove = (r: Role) =>
    onChange({
      selected: selected.filter((r2) => r2.id !== r.id),
      active: r.id === active?.id ? undefined : active,
    })

  const activate = (r: Role) => onChange({ selected, active: r })

  return (
    <M.FormControl className={classes.root} margin="normal" error={!!error}>
      {!!label && <M.InputLabel shrink>{label}</M.InputLabel>}
      <div className={classes.chips}>
        {selected.map((r) =>
          active?.id === r.id ? (
            <M.Chip
              key={r.id}
              label={r.name}
              size="small"
              color="primary"
              className={classes.chip}
              onDelete={() => remove(r)}
              disabled={disabled}
            />
          ) : (
            <M.Chip
              key={r.id}
              label={r.name}
              size="small"
              variant="outlined"
              color="primary"
              className={classes.chip}
              onDelete={() => remove(r)}
              clickable
              onClick={() => activate(r)}
              disabled={disabled}
            />
          ),
        )}
        {available.length > 0 && (
          <M.Chip
            label={selected.length ? 'Add' : 'Assign'}
            size="small"
            variant="outlined"
            className={classes.chip}
            classes={{ deleteIcon: classes.addIcon }}
            clickable
            onDelete={openAddMenu}
            onClick={openAddMenu}
            disabled={disabled}
          />
        )}
      </div>
      <M.Menu anchorEl={anchorEl} keepMounted open={!!anchorEl} onClose={closeAddMenu}>
        {available.map((r) => (
          <M.MenuItem
            key={r.id}
            onClick={() => {
              closeAddMenu()
              add(r)
            }}
          >
            {r.name}
          </M.MenuItem>
        ))}
      </M.Menu>
      {!!error && (
        <M.FormHelperText error>
          {error === 'required' ? 'Assign a role please' : error}
        </M.FormHelperText>
      )}
      <M.FormHelperText error={false}>
        User can assume any of the assigned roles
      </M.FormHelperText>
    </M.FormControl>
  )
}

const useDialogFormStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(-3),
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
}

function Invite({ close, roles, defaultRole }: InviteProps) {
  const classes = useInviteStyles()
  const create = GQL.useMutation(USER_CREATE_MUTATION)
  const { push } = Notifications.use()

  interface FormValues {
    username: string
    email: string
    roles: RoleSelectValue
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

  const active = defaultRole || roles[0]
  const selected = [active]

  return (
    <RF.Form<FormValues>
      onSubmit={onSubmit}
      initialValues={{ roles: { active, selected } }}
      initialValuesEqual={R.equals}
      keepDirtyOnReinitialize
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
              <RF.Field<RoleSelectValue> name="roles" validate={validateRoleSelect}>
                {(props) => <RoleSelect label="Roles" roles={roles} {...props} />}
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
  user: User
}

function EditRoles({ close, roles, user }: EditRolesProps) {
  const { push } = Notifications.use()
  const setRole = GQL.useMutation(USER_SET_ROLE_MUTATION)

  interface FormValues {
    roles: RoleSelectValue
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
    () => user.extraRoles.concat(user.role ?? []).sort(ROLE_NAME_ASC),
    [user.extraRoles, user.role],
  )

  return (
    <RF.Form<FormValues>
      onSubmit={onSubmit}
      initialValues={{ roles: { active: user.role, selected } }}
      initialValuesEqual={R.equals}
      keepDirtyOnReinitialize
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
          <M.DialogTitle>Assign roles to &quot;{user.name}&quot;</M.DialogTitle>
          <M.DialogContent>
            <DialogForm onSubmit={handleSubmit}>
              <RF.Field<RoleSelectValue> name="roles" validate={validateRoleSelect}>
                {(props) => <RoleSelect label="Roles" roles={roles} {...props} />}
              </RF.Field>
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
  openDialog: Dialogs.Open
}

function RoleDisplay({ user, roles, openDialog }: RoleDisplayProps) {
  const edit = () =>
    openDialog(({ close }) => <EditRoles {...{ close, roles, user }} />, DIALOG_PROPS)

  return (
    <M.Tooltip title="Click to edit">
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
        disabled={isSelf}
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
    getDisplay: (_v, u, { roles, openDialog }: ColumnDisplayProps) => (
      <RoleDisplay user={u} roles={roles} openDialog={openDialog} />
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
        disabled={isSelf}
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
  } as $TSFixMe)

  const toolbarActions = [
    {
      title: 'Invite',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        openDialog(
          ({ close }) => <Invite {...{ close, roles, defaultRole }} />,
          DIALOG_PROPS,
        )
      }, [roles, defaultRole, openDialog]),
    },
  ]

  const self: string = redux.useSelector(Auth.selectors.username)

  const inlineActions = (user: User) => [
    user.name === self
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
    openDialog,
    isSelf: u.name === self,
  })

  return (
    <>
      <Table.Toolbar heading="Users" actions={toolbarActions}>
        <Table.Filter {...filtering} />
      </Table.Toolbar>
      <Table.Wrapper>
        <M.Table size="small" className={classes.table}>
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
    </>
  )
}
