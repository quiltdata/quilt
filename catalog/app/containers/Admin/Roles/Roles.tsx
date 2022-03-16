import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as IO from 'io-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as Model from 'model'
import * as Dialogs from 'utils/Dialogs'
import type FormSpec from 'utils/FormSpec'
import assertNever from 'utils/assertNever'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'

import * as Form from '../RFForm'
import * as Table from '../Table'

import BucketsPermissions from './BucketsPermissions'
import BUCKETS_QUERY from './gql/Buckets.generated'
import ROLES_QUERY from './gql/Roles.generated'
import ROLE_CREATE_MANAGED_MUTATION from './gql/CreateManaged.generated'
import ROLE_CREATE_UNMANAGED_MUTATION from './gql/CreateUnmanaged.generated'
import ROLE_UPDATE_MANAGED_MUTATION from './gql/UpdateManaged.generated'
import ROLE_UPDATE_UNMANAGED_MUTATION from './gql/UpdateUnmanaged.generated'
import ROLE_DELETE_MUTATION from './gql/Delete.generated'
import ROLE_SET_DEFAULT_MUTATION from './gql/SetDefault.generated'
import { RoleSelectionFragment as Role } from './gql/RoleSelection.generated'

const IAM_HOME = 'https://console.aws.amazon.com/iam/home'
const ARN_ROLE_RE = /^arn:aws:iam:[^:]*:\d+:role\/(.+)$/
const ARN_POLICY_RE = /^arn:aws:iam:[^:]*:\d+:policy\/(.+)$/

const getARNLink = (arn: string) => {
  const [, role] = arn.match(ARN_ROLE_RE) || []
  if (role) return `${IAM_HOME}#/roles/${role}`
  const [, policy] = arn.match(ARN_POLICY_RE) || []
  if (policy) return `${IAM_HOME}#/policies/${arn}`
  return undefined
}

const columns = [
  {
    id: 'name',
    label: 'Name',
    getValue: R.prop('name'),
    props: { component: 'th', scope: 'row' },
    getDisplay: (
      value: string,
      r: Role,
      { defaultRoleId }: { defaultRoleId: string | null },
    ) =>
      r.id === defaultRoleId ? (
        <M.Tooltip title="Automatically assigned to new users.">
          <strong>{value}*</strong>
        </M.Tooltip>
      ) : (
        value
      ),
  },
  {
    id: 'source',
    label: 'Source',
    getValue: (r: Role) => r.__typename === 'ManagedRole',
    getDisplay: (value: boolean) =>
      value ? (
        <abbr title="This IAM role is created and managed by Quilt">Quilt</abbr>
      ) : (
        <abbr title="This IAM role is provided and managed by you or another administrator">
          Custom
        </abbr>
      ),
  },
  {
    id: 'buckets',
    label: 'Buckets',
    getValue: (r: Role) =>
      r.__typename === 'ManagedRole'
        ? r.permissions.filter((p) => !!p.level).length
        : null,
    getDisplay: (buckets: number | null) => (buckets == null ? 'N/A' : buckets),
  },
]

const useStyles = M.makeStyles((t) => ({
  lock: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    bottom: 52,
    cursor: 'not-allowed',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 64,
    zIndex: 3, // above Select, Checkbox and sticky table header
  },
  title: {
    '&>*': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
  panel: {
    marginTop: t.spacing(2),
  },
}))

interface CreateProps {
  close: (reason?: string) => void
}

function Create({ close }: CreateProps) {
  const classes = useStyles()

  const [, createManaged] = urql.useMutation(ROLE_CREATE_MANAGED_MUTATION)
  const [, createUnmanaged] = urql.useMutation(ROLE_CREATE_UNMANAGED_MUTATION)

  const { push } = Notifications.use()

  const [{ data }] = urql.useQuery({ query: BUCKETS_QUERY })
  const { buckets } = data!

  const [managed, setManaged] = React.useState(true)

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        let res
        if (managed) {
          const input = R.applySpec(managedRoleFormSpec)(values)
          res = await createManaged({ input })
        } else {
          const input = R.applySpec(unmanagedRoleFormSpec)(values)
          res = await createUnmanaged({ input })
        }
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.roleCreate
        switch (r.__typename) {
          case 'RoleCreateSuccess':
            push(`Role "${r.role.name}" created`)
            close()
            return undefined
          case 'RoleNameReserved':
            return { name: 'reserved' }
          case 'RoleNameExists':
            return { name: 'taken' }
          case 'RoleNameInvalid':
            return { name: 'invalid' }
          case 'BucketConfigDoesNotExist':
            throw new Error(r.__typename)
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error creating role')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [managed, createManaged, createUnmanaged, push, close],
  )

  const initialPermissions: Model.GQLTypes.PermissionInput[] = React.useMemo(
    () =>
      FP.function.pipe(
        buckets,
        R.sort((a, b) => a.name.localeCompare(b.name)),
        R.map(({ name }) => ({ bucket: name, level: null })),
      ),
    [buckets],
  )

  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ permissions: initialPermissions }}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        hasValidationErrors,
        submitError,
      }) => (
        <>
          <M.DialogTitle disableTypography>
            <M.Typography variant="h5">Create a role</M.Typography>
          </M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                // @ts-expect-error
                component={Form.Field}
                name="name"
                validate={validators.required as FF.FieldValidator<any>}
                placeholder="Enter role name"
                label="Name"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a role name',
                  reserved: 'This is a reserved name, please use another',
                  taken: 'Role with this name already exists',
                  invalid: (
                    <>
                      Enter a{' '}
                      <abbr title="Must start with a letter and contain only alphanumeric characters and underscores thereafter">
                        valid
                      </abbr>{' '}
                      role name
                    </>
                  ),
                }}
              />

              <M.FormControlLabel
                label="Manually set ARN instead of configuring per-bucket permissions"
                control={<M.Checkbox checked={!managed} />}
                onChange={() => setManaged(!managed)}
              />

              <M.Collapse in={!managed}>
                <RF.Field
                  // @ts-expect-error
                  component={Form.Field}
                  name="arn"
                  validate={(v) => (managed ? undefined : validators.required(v))}
                  placeholder="Enter role ARN"
                  label="ARN"
                  fullWidth
                  margin="normal"
                  disabled={managed}
                  errors={{
                    required: 'Enter an ARN',
                  }}
                />
              </M.Collapse>

              <M.Collapse in={managed}>
                <RF.Field
                  className={classes.panel}
                  // @ts-expect-error
                  component={BucketsPermissions}
                  name="permissions"
                  fullWidth
                  margin="normal"
                  onAdvanced={() => setManaged(false)}
                />
              </M.Collapse>

              {submitFailed && (
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
              disabled={submitting || (submitFailed && hasValidationErrors)}
            >
              Create
            </M.Button>
          </M.DialogActions>
          {submitting && (
            <div className={classes.lock}>
              <M.CircularProgress size={80} />
            </div>
          )}
        </>
      )}
    </RF.Form>
  )
}

interface DeleteProps {
  role: Role
  close: (reason?: string) => void
}

function Delete({ role, close }: DeleteProps) {
  const { push } = Notifications.use()
  const [, deleteRole] = urql.useMutation(ROLE_DELETE_MUTATION)

  const doDelete = React.useCallback(async () => {
    close()
    try {
      const res = await deleteRole({ id: role.id })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data')
      const r = res.data.roleDelete
      switch (r.__typename) {
        case 'RoleDeleteSuccess':
        case 'RoleDoesNotExist': // ignore if role was not found
          return
        case 'RoleNameReserved':
          push(`Unable to delete reserved role "${role.name}"`)
          return
        case 'RoleAssigned':
          push(
            `Unable to delete role "${role.name}" assigned to some user(s). Unassign this role from everyone and try again.`,
          )
          return
        default:
          assertNever(r)
      }
    } catch (e) {
      push(`Error deleting role "${role.name}"`)
      // eslint-disable-next-line no-console
      console.error('Error deleting role')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [close, push, deleteRole, role.id, role.name])

  return (
    <>
      <M.DialogTitle>Delete a role</M.DialogTitle>
      <M.DialogContent>
        You are about to delete the &quot;{role.name}&quot; role. This operation is
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

interface SetDefaultProps {
  role: Role
  close: (reason?: string) => void
}

function SetDefault({ role, close }: SetDefaultProps) {
  const { push } = Notifications.use()
  const [, setDefault] = urql.useMutation(ROLE_SET_DEFAULT_MUTATION)

  const doSetDefault = React.useCallback(async () => {
    close()
    try {
      const res = await setDefault({ id: role.id })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data')
      const r = res.data.roleSetDefault
      switch (r.__typename) {
        case 'RoleDoesNotExist':
          throw new Error(r.__typename)
        case 'RoleSetDefaultSuccess':
          return
        default:
          assertNever(r)
      }
    } catch (e) {
      push(`Error setting default role "${role.name}"`)
      // eslint-disable-next-line no-console
      console.error('Error setting default role')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [close, push, setDefault, role.id, role.name])

  return (
    <>
      <M.DialogTitle>Set default role</M.DialogTitle>
      <M.DialogContent>
        You are about to make &quot;{role.name}&quot; the default role for all new users.
        Are you sure you want to do this?
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={doSetDefault} color="primary">
          Set default
        </M.Button>
      </M.DialogActions>
    </>
  )
}

const unmanagedRoleFormSpec: FormSpec<Model.GQLTypes.UnmanagedRoleInput> = {
  name: R.pipe(
    R.prop('name'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
  arn: R.pipe(
    R.prop('arn'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
}

const PermissionInput = IO.type(
  {
    bucket: IO.string,
    level: Types.nullable(Model.BucketPermissionLevel),
  },
  'PermissionInput',
)

const managedRoleFormSpec: FormSpec<Model.GQLTypes.ManagedRoleInput> = {
  name: R.pipe(
    R.prop('name'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
  permissions: R.pipe(
    R.prop('permissions'),
    Types.decode(IO.readonlyArray(PermissionInput)),
  ),
}

interface EditProps {
  role: Role
  close: (reason?: string) => void
}

function Edit({ role, close }: EditProps) {
  const [, updateManaged] = urql.useMutation(ROLE_UPDATE_MANAGED_MUTATION)
  const [, updateUnmanaged] = urql.useMutation(ROLE_UPDATE_UNMANAGED_MUTATION)

  const managed = role.__typename === 'ManagedRole'

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        let res
        if (managed) {
          const input = R.applySpec(managedRoleFormSpec)(values)
          res = await updateManaged({ input, id: role.id })
        } else {
          const input = R.applySpec(unmanagedRoleFormSpec)(values)
          res = await updateUnmanaged({ input, id: role.id })
        }
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.roleUpdate
        switch (r.__typename) {
          case 'RoleUpdateSuccess':
            close()
            return undefined
          case 'RoleNameReserved':
            return { name: 'reserved' }
          case 'RoleNameExists':
            return { name: 'taken' }
          case 'RoleNameInvalid':
            return { name: 'invalid' }
          case 'RoleIsManaged':
          case 'RoleIsUnmanaged':
          case 'BucketConfigDoesNotExist':
            throw new Error(r.__typename)
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating role')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [managed, role.id, updateManaged, updateUnmanaged, close],
  )

  const classes = useStyles()

  const initialValues = React.useMemo(
    () => ({
      name: role.name,
      permissions:
        role.__typename === 'ManagedRole'
          ? role.permissions.map(
              (p) =>
                ({
                  bucket: p.bucket.name,
                  level: p.level,
                } as Model.GQLTypes.PermissionInput),
            )
          : [],
      arn: role.__typename === 'UnmanagedRole' ? role.arn : null,
    }),
    [role],
  )

  const title = (
    <>
      Edit{' '}
      {managed ? (
        <abbr title="This IAM role is created and managed by Quilt">Quilt</abbr>
      ) : (
        <abbr title="This IAM role is provided and managed by you or another administrator">
          custom
        </abbr>
      )}{' '}
      role &quot;{role.name}&quot;
    </>
  )

  const titleStr = `Edit ${managed ? 'Quilt' : 'custom'} role "${role.name}"`

  return (
    <RF.Form onSubmit={onSubmit} initialValues={initialValues}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        pristine,
        hasValidationErrors,
        submitError,
      }) => (
        <>
          <M.DialogTitle className={classes.title} title={titleStr}>
            {title}
          </M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                // @ts-expect-error
                component={Form.Field}
                name="name"
                validate={validators.required as FF.FieldValidator<any>}
                placeholder="Enter role name"
                label="Name"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a role name',
                  reserved: 'This is a reserved name, please use another',
                  taken: 'Role with this name already exists',
                  invalid: 'Invalid name for role',
                }}
              />
              {managed ? (
                <>
                  <M.TextField
                    value={role.arn}
                    label="ARN"
                    fullWidth
                    margin="normal"
                    disabled
                  />
                  <RF.Field
                    className={classes.panel}
                    // @ts-expect-error
                    component={BucketsPermissions}
                    name="permissions"
                    fullWidth
                    margin="normal"
                  />
                </>
              ) : (
                <RF.Field
                  // @ts-expect-error
                  component={Form.Field}
                  name="arn"
                  validate={validators.required as FF.FieldValidator<any>}
                  placeholder="Enter role ARN"
                  label="ARN"
                  fullWidth
                  margin="normal"
                  errors={{
                    required: 'Enter an ARN',
                  }}
                />
              )}

              {submitFailed && (
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
              disabled={pristine || submitting || (submitFailed && hasValidationErrors)}
            >
              Save
            </M.Button>
          </M.DialogActions>
          {submitting && (
            <div className={classes.lock}>
              <M.CircularProgress size={80} />
            </div>
          )}
        </>
      )}
    </RF.Form>
  )
}

interface SettingsMenuProps {
  role: Role
  openDialog: (render: (props: DialogsOpenProps) => JSX.Element, props?: $TSFixMe) => void
}

function SettingsMenu({ role, openDialog }: SettingsMenuProps) {
  const openDeleteDialog = React.useCallback(() => {
    openDialog(({ close }) => <Delete {...{ role, close }} />)
  }, [openDialog, role])

  const openSetDefaultDialog = React.useCallback(() => {
    openDialog(({ close }) => <SetDefault {...{ role, close }} />)
  }, [openDialog, role])

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget)
    },
    [setAnchorEl],
  )

  const handleClose = React.useCallback(() => {
    setAnchorEl(null)
  }, [setAnchorEl])

  const handleMakeDefault = React.useCallback(() => {
    handleClose()
    openSetDefaultDialog()
  }, [handleClose, openSetDefaultDialog])

  const handleDelete = React.useCallback(() => {
    handleClose()
    openDeleteDialog()
  }, [handleClose, openDeleteDialog])

  return (
    <>
      <M.Tooltip title="Settings">
        <M.IconButton aria-label="Settings" onClick={handleClick}>
          <M.Icon>more_vert</M.Icon>
        </M.IconButton>
      </M.Tooltip>
      <M.Menu anchorEl={anchorEl} keepMounted open={!!anchorEl} onClose={handleClose}>
        <M.MenuItem onClick={handleMakeDefault}>Set as default</M.MenuItem>
        <M.MenuItem onClick={handleDelete}>Delete</M.MenuItem>
      </M.Menu>
    </>
  )
}

// XXX: move to dialogs module
interface DialogsOpenProps {
  close: (reason?: string) => void
}

export default function Roles() {
  const [{ data }] = urql.useQuery({ query: ROLES_QUERY })
  const rows = data!.roles
  const defaultRoleId = data!.defaultRole?.id

  const ordering = Table.useOrdering({ rows, column: columns[0] })
  const dialogs = Dialogs.use()

  const toolbarActions = [
    {
      title: 'Create',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        dialogs.open(({ close }: DialogsOpenProps) => <Create {...{ close }} />)
      }, [dialogs.open]), // eslint-disable-line react-hooks/exhaustive-deps
    },
  ]

  const inlineActions = (role: Role) => [
    role.arn
      ? {
          title: 'Open AWS Console',
          icon: <M.Icon>launch</M.Icon>,
          href: getARNLink(role.arn),
        }
      : null,
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: () => {
        dialogs.open(({ close }: DialogsOpenProps) => (
          <Edit
            {...{
              role,
              close,
            }}
          />
        ))
      },
    },
  ]

  return (
    <React.Suspense
      fallback={
        <M.Paper>
          <Table.Toolbar heading="Roles" />
          <Table.Progress />
        </M.Paper>
      }
    >
      <M.Paper>
        {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
        <Table.Toolbar heading="Roles" actions={toolbarActions} />
        <Table.Wrapper>
          <M.Table>
            <Table.Head columns={columns} ordering={ordering} withInlineActions />
            <M.TableBody>
              {ordering.ordered.map((i: Role) => (
                <M.TableRow hover key={i.id}>
                  {columns.map((col) => (
                    // @ts-expect-error
                    <M.TableCell key={col.id} {...col.props}>
                      {/* @ts-expect-error */}
                      {(col.getDisplay || R.identity)(col.getValue(i), i, {
                        defaultRoleId,
                      })}
                    </M.TableCell>
                  ))}
                  <M.TableCell align="right" padding="none">
                    <Table.InlineActions actions={inlineActions(i)}>
                      {/* @ts-expect-error */}
                      <SettingsMenu role={i} openDialog={dialogs.open} />
                    </Table.InlineActions>
                  </M.TableCell>
                </M.TableRow>
              ))}
            </M.TableBody>
          </M.Table>
        </Table.Wrapper>
      </M.Paper>
    </React.Suspense>
  )
}
