import * as FF from 'final-form'
import * as IO from 'io-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as Dialogs from 'utils/Dialogs'
import type FormSpec from 'utils/FormSpec'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'

import * as Form from '../Form'
import * as Table from '../Table'

import AttachedPolicies from './AttachedPolicies'
import Hint from './Hint'
import SsoConfig from './SsoConfig'
import { MAX_POLICIES_PER_ROLE, getArnLink } from './shared'

import ROLES_QUERY from './gql/Roles.generated'
import ROLE_CREATE_MANAGED_MUTATION from './gql/RoleCreateManaged.generated'
import ROLE_CREATE_UNMANAGED_MUTATION from './gql/RoleCreateUnmanaged.generated'
import ROLE_UPDATE_MANAGED_MUTATION from './gql/RoleUpdateManaged.generated'
import ROLE_UPDATE_UNMANAGED_MUTATION from './gql/RoleUpdateUnmanaged.generated'
import ROLE_DELETE_MUTATION from './gql/RoleDelete.generated'
import ROLE_SET_DEFAULT_MUTATION from './gql/RoleSetDefault.generated'
import { RoleSelectionFragment as Role } from './gql/RoleSelection.generated'

const columns: Table.Column<Role>[] = [
  {
    id: 'name',
    label: 'Name',
    getValue: R.prop('name'),
    props: { component: 'th', scope: 'row' },
    getDisplay: (
      value: string,
      r: Role,
      {
        defaultRoleId,
        urls,
        classes,
      }: { defaultRoleId: string | null; urls: $TSFixMe; classes: $TSFixMe },
    ) => (
      <span className={classes.nameCell}>
        <M.Tooltip title={`Open ${value}`}>
          <StyledLink to={urls.adminRoleDetail(r.id)}>{value}</StyledLink>
        </M.Tooltip>
        {r.id === defaultRoleId && (
          <M.Tooltip title="Automatically assigned to every new user">
            <span className={classes.defaultTag}>default</span>
          </M.Tooltip>
        )}
      </span>
    ),
  },
  {
    id: 'source',
    label: 'Source',
    getValue: (r: Role) => r.__typename === 'ManagedRole',
    getDisplay: (value: boolean, _r: Role, { classes }: { classes: $TSFixMe }) => (
      <Hint
        className={classes.sourceTag}
        title={
          value
            ? 'This IAM role is created and managed by Quilt'
            : 'This IAM role is provided and managed by you or another administrator'
        }
      >
        {value ? 'Quilt' : 'Custom'}
      </Hint>
    ),
  },
  {
    id: 'policies',
    label: 'Associated policies',
    getValue: (r: Role) => (r.__typename === 'ManagedRole' ? r.policies.length : null),
    getDisplay: (_policies: any, r: Role, { classes }: { classes: $TSFixMe }) =>
      r.__typename === 'ManagedRole' ? (
        <M.Tooltip
          arrow
          title={
            r.policies.length ? (
              <M.Box component="ul" pl={1} m={0.5}>
                {r.policies.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </M.Box>
            ) : (
              ''
            )
          }
        >
          <span>
            {r.policies.length} / {MAX_POLICIES_PER_ROLE}
          </span>
        </M.Tooltip>
      ) : (
        <Hint
          className={classes.unknown}
          title="Access for a custom role lives in IAM, which Quilt cannot read"
        >
          Set in AWS
        </Hint>
      ),
  },
  {
    id: 'buckets',
    label: 'Buckets',
    getValue: (r: Role) => (r.__typename === 'ManagedRole' ? r.permissions.length : null),
    getDisplay: (_buckets: any, r: Role, { classes }: { classes: $TSFixMe }) =>
      r.__typename === 'ManagedRole' ? (
        <M.Tooltip
          arrow
          title={
            r.permissions.length ? (
              <M.Box component="ul" pl={1} m={0.5}>
                {r.permissions.map((p) => (
                  <li key={p.bucket.name}>
                    {p.bucket.name} ({p.level})
                  </li>
                ))}
              </M.Box>
            ) : (
              ''
            )
          }
        >
          <span>{r.permissions.length}</span>
        </M.Tooltip>
      ) : (
        <Hint
          className={classes.unknown}
          title="Access for a custom role lives in IAM, which Quilt cannot read"
        >
          Set in AWS
        </Hint>
      ),
  },
]

const useStyles = M.makeStyles((t) => ({
  nameCell: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  defaultTag: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.secondary.main}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.secondary.dark,
    lineHeight: 1.6,
    padding: t.spacing(0, 0.75),
    whiteSpace: 'nowrap',
  },
  sourceTag: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.secondary,
    lineHeight: 1.6,
    padding: t.spacing(0, 0.75),
    whiteSpace: 'nowrap',
  },
  unknown: {
    color: t.palette.text.secondary,
    fontStyle: 'italic',
  },
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

  const createManaged = GQL.useMutation(ROLE_CREATE_MANAGED_MUTATION)
  const createUnmanaged = GQL.useMutation(ROLE_CREATE_UNMANAGED_MUTATION)

  const { push } = Notifications.use()

  const [managed, setManaged] = React.useState(true)

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        let data
        if (managed) {
          const input = R.applySpec(managedRoleFormSpec)(values)
          data = await createManaged({ input })
        } else {
          const input = R.applySpec(unmanagedRoleFormSpec)(values)
          data = await createUnmanaged({ input })
        }
        const r = data.roleCreate
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
          case 'RoleHasTooManyPoliciesToAttach':
            return { policies: 'Too many policies to attach' }
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

  return (
    <RF.Form onSubmit={onSubmit} initialValues={INITIAL_VALUES}>
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
                label="Manually set ARN instead of configuring policies"
                control={<M.Checkbox checked={!managed} />}
                onChange={() => setManaged(!managed)}
              />

              <M.Collapse in={!managed}>
                <RF.Field
                  component={Form.Field}
                  name="arn"
                  validate={
                    managed ? undefined : (validators.required as FF.FieldValidator<any>)
                  }
                  // to re-trigger validation when "managed" state changes
                  key={`${managed}`}
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
                  component={AttachedPolicies}
                  name="policies"
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

export interface DeleteProps {
  role: Role
  close: (reason?: string) => void
  // The list's row simply disappears; a page about the role has to leave it.
  onDeleted?: () => void
}

export function Delete({ role, close, onDeleted }: DeleteProps) {
  const { push } = Notifications.use()
  const deleteRole = GQL.useMutation(ROLE_DELETE_MUTATION)

  const doDelete = React.useCallback(async () => {
    close()
    try {
      const { roleDelete: r } = await deleteRole({ id: role.id })
      switch (r.__typename) {
        case 'RoleDeleteSuccess':
        case 'RoleDoesNotExist': // ignore if role was not found
          onDeleted?.()
          return
        case 'RoleNameReserved':
          push(`Unable to delete reserved role "${role.name}"`)
          return
        case 'RoleAssigned':
          push(
            `Unable to delete role "${role.name}" assigned to some user(s). Unassign this role from everyone and try again.`,
          )
          return
        case 'RoleNameUsedBySsoConfig':
          push("Can't delete role used by SSO configuration")
          return
        case 'RoleOwnsDataProducts':
          push("Can't delete a role that owns data products")
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
  }, [close, push, deleteRole, role.id, role.name, onDeleted])

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

export interface SetDefaultProps {
  role: Role
  close: (reason?: string) => void
}

export function SetDefault({ role, close }: SetDefaultProps) {
  const { push } = Notifications.use()
  const setDefault = GQL.useMutation(ROLE_SET_DEFAULT_MUTATION)

  const doSetDefault = React.useCallback(async () => {
    close()
    try {
      const { roleSetDefault: r } = await setDefault({ id: role.id })
      switch (r.__typename) {
        case 'SsoConfigConflict':
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

const managedRoleFormSpec: FormSpec<Model.GQLTypes.ManagedRoleInput> = {
  name: R.pipe(
    R.prop('name'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
  policies: R.pipe(
    R.prop('policies'),
    Types.decode(IO.array(IO.type({ id: IO.string }))),
    R.pluck('id'),
    Types.decode(IO.readonlyArray(Types.NonEmptyString)),
  ),
}

const INITIAL_VALUES = { managed: true, policies: [] }

export interface EditProps {
  role: Role
  close: (reason?: string) => void
}

export function Edit({ role, close }: EditProps) {
  const updateManaged = GQL.useMutation(ROLE_UPDATE_MANAGED_MUTATION)
  const updateUnmanaged = GQL.useMutation(ROLE_UPDATE_UNMANAGED_MUTATION)

  const managed = role.__typename === 'ManagedRole'

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        let data
        if (managed) {
          const input = R.applySpec(managedRoleFormSpec)(values)
          data = await updateManaged({ input, id: role.id })
        } else {
          const input = R.applySpec(unmanagedRoleFormSpec)(values)
          data = await updateUnmanaged({ input, id: role.id })
        }
        const r = data.roleUpdate
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
          case 'RoleHasTooManyPoliciesToAttach':
            return { policies: 'Too many policies to attach' }
          case 'RoleIsManaged':
          case 'RoleIsUnmanaged':
          case 'RoleNameUsedBySsoConfig':
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
      policies: role.__typename === 'ManagedRole' ? role.policies : [],
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
                    component={AttachedPolicies}
                    name="policies"
                    fullWidth
                    margin="normal"
                  />
                </>
              ) : (
                <RF.Field
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
  openDialog: Dialogs.Dialogs['open']
  isDefaultRoleSettingDisabled: boolean
}

function SettingsMenu({
  role,
  openDialog,
  isDefaultRoleSettingDisabled,
}: SettingsMenuProps) {
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
        {!isDefaultRoleSettingDisabled && (
          <M.MenuItem onClick={handleMakeDefault}>Set as default</M.MenuItem>
        )}
        <M.MenuItem onClick={handleDelete}>Delete</M.MenuItem>
      </M.Menu>
    </>
  )
}

export default function Roles() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const data = GQL.useQueryS(ROLES_QUERY)
  const rows = data.roles
  const defaultRoleId = data.defaultRole?.id
  const isDefaultRoleSettingDisabled = !!data.admin?.isDefaultRoleSettingDisabled

  const filtering = Table.useFiltering({
    rows,
    filterBy: ({ name }) => name,
  })
  const ordering = Table.useOrdering({
    rows: filtering.filtered,
    column: columns[0],
  })
  const dialogs = Dialogs.use()

  const toolbarActions = [
    {
      title: 'SSO Config',
      icon: <M.Icon>assignment_ind</M.Icon>,
      fn: React.useCallback(() => {
        dialogs.open(({ close }) => <SsoConfig {...{ close }} />)
      }, [dialogs.open]), // eslint-disable-line react-hooks/exhaustive-deps
    },
    {
      title: 'Create',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        dialogs.open(({ close }) => <Create {...{ close }} />)
      }, [dialogs.open]), // eslint-disable-line react-hooks/exhaustive-deps
    },
  ]

  const inlineActions = (role: Role) => [
    role.arn
      ? ({
          title: 'Open AWS Console',
          icon: <M.Icon>launch</M.Icon>,
          href: getArnLink(role.arn),
        } as Table.Action)
      : null,
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: () => {
        dialogs.open(({ close }) => (
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
    <>
      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
      <Table.Toolbar heading="Roles" actions={toolbarActions}>
        <Table.Filter {...filtering} />
      </Table.Toolbar>
      <Table.Wrapper>
        <M.Table>
          <Table.Head columns={columns} ordering={ordering} withInlineActions />
          <M.TableBody>
            {ordering.ordered.map((i: Role) => (
              <M.TableRow hover key={i.id}>
                {columns.map((col) => (
                  <M.TableCell key={col.id} {...col.props}>
                    {(col.getDisplay || R.identity)(col.getValue(i), i, {
                      defaultRoleId,
                      urls,
                      classes,
                    })}
                  </M.TableCell>
                ))}
                <M.TableCell align="right" padding="none">
                  <Table.InlineActions actions={inlineActions(i)}>
                    <SettingsMenu
                      role={i}
                      openDialog={dialogs.open}
                      isDefaultRoleSettingDisabled={isDefaultRoleSettingDisabled}
                    />
                  </Table.InlineActions>
                </M.TableCell>
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
      </Table.Wrapper>
    </>
  )
}
