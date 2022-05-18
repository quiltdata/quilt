import * as FF from 'final-form'
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
import { mkFormError, mapInputErrors } from 'utils/formTools'
import * as Types from 'utils/types'
import validate, * as validators from 'utils/validators'

import * as Form from '../RFForm'
import * as Table from '../Table'

import AssociatedRoles from './AssociatedRoles'
import BucketsPermissions from './BucketsPermissions'
import { getArnLink } from './shared'

import POLICIES_QUERY from './gql/Policies.generated'
import POLICY_CREATE_MANAGED_MUTATION from './gql/PolicyCreateManaged.generated'
import POLICY_CREATE_UNMANAGED_MUTATION from './gql/PolicyCreateUnmanaged.generated'
import POLICY_UPDATE_MANAGED_MUTATION from './gql/PolicyUpdateManaged.generated'
import POLICY_UPDATE_UNMANAGED_MUTATION from './gql/PolicyUpdateUnmanaged.generated'
import POLICY_DELETE_MUTATION from './gql/PolicyDelete.generated'
import { BucketPermissionSelectionFragment as BucketPermission } from './gql/BucketPermissionSelection.generated'
import { PolicySelectionFragment as Policy } from './gql/PolicySelection.generated'

const validateNonEmptyString: FF.FieldValidator<any> = validate(
  'nonEmptyString',
  validators.matches(/\S/),
)

const columns = [
  {
    id: 'title',
    label: 'Title',
    getValue: R.prop('title'),
    props: { component: 'th', scope: 'row' },
  },
  {
    id: 'source',
    label: 'Source',
    getValue: (p: Policy) => p.managed,
    getDisplay: (value: boolean) =>
      value ? (
        <abbr title="This IAM policy is created and managed by Quilt">Quilt</abbr>
      ) : (
        <abbr title="This IAM policy is provided and managed by you or another administrator">
          Custom
        </abbr>
      ),
  },
  {
    id: 'buckets',
    label: 'Buckets',
    getValue: (p: Policy) => (p.managed ? p.permissions.length : null),
    getDisplay: (_buckets: any, p: Policy) =>
      p.managed ? (
        <M.Tooltip
          arrow
          title={
            p.permissions.length ? (
              <M.Box component="ul" pl={1} m={0.5}>
                {p.permissions.map((pp) => (
                  <li key={pp.bucket.name}>
                    {pp.bucket.name} ({pp.level})
                  </li>
                ))}
              </M.Box>
            ) : (
              ''
            )
          }
        >
          <span>{p.permissions.length}</span>
        </M.Tooltip>
      ) : (
        'N/A'
      ),
  },
  {
    id: 'roles',
    label: 'Associated roles',
    getValue: (p: Policy) => (p.managed ? p.roles.length : null),
    getDisplay: (_roles: any, p: Policy) => (
      <M.Tooltip
        arrow
        title={
          p.roles.length ? (
            <M.Box component="ul" pl={1} m={0.5}>
              {p.roles.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
            </M.Box>
          ) : (
            ''
          )
        }
      >
        <span>{p.roles.length}</span>
      </M.Tooltip>
    ),
  },
]

const INITIAL_VALUES = { permissions: [], roles: [] }

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

  const [, createManaged] = urql.useMutation(POLICY_CREATE_MANAGED_MUTATION)
  const [, createUnmanaged] = urql.useMutation(POLICY_CREATE_UNMANAGED_MUTATION)

  const { push } = Notifications.use()

  const [managed, setManaged] = React.useState(true)

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        let res
        if (managed) {
          const input = R.applySpec(managedPolicyFormSpec)(values)
          res = await createManaged({ input })
        } else {
          const input = R.applySpec(unmanagedPolicyFormSpec)(values)
          res = await createUnmanaged({ input })
        }
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.policyCreate
        switch (r.__typename) {
          case 'Policy':
            push(`Policy "${r.title}" created`)
            close()
            return undefined
          case 'InvalidInput':
            return mapInputErrors(r.errors, {
              'input.arn': 'arn',
              'input.roles': 'roles',
              'input.title': 'title',
            })
          case 'OperationError':
            return mkFormError(r.message)
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error creating policy')
        // eslint-disable-next-line no-console
        console.error(e)
        return mkFormError('unexpected')
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
            <M.Typography variant="h5">Create a policy</M.Typography>
          </M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="title"
                validate={validators.composeAnd(
                  validators.required,
                  validateNonEmptyString,
                )}
                placeholder="Enter policy title"
                label="Title"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a policy title',
                  nonEmptyString: 'Enter a non-empty policy title',
                }}
              />

              <M.FormControlLabel
                label="Manually set ARN instead of configuring per-bucket permissions"
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
                  placeholder="Enter policy ARN"
                  label="ARN"
                  fullWidth
                  margin="normal"
                  errors={{
                    required: 'Enter an ARN',
                  }}
                />
              </M.Collapse>

              <M.Collapse in={managed}>
                <RF.Field
                  className={classes.panel}
                  component={BucketsPermissions}
                  name="permissions"
                  fullWidth
                  margin="normal"
                  onAdvanced={() => setManaged(false)}
                />
              </M.Collapse>

              <RF.Field
                className={classes.panel}
                component={AssociatedRoles}
                name="roles"
                fullWidth
                margin="normal"
              />

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
  policy: Policy
  close: (reason?: string) => void
}

function Delete({ policy, close }: DeleteProps) {
  const { push } = Notifications.use()
  const [, deletePolicy] = urql.useMutation(POLICY_DELETE_MUTATION)

  const doDelete = React.useCallback(async () => {
    close()
    try {
      const res = await deletePolicy({ id: policy.id })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data')
      const r = res.data.policyDelete
      switch (r.__typename) {
        case 'Ok':
          return
        case 'InvalidInput':
          // shouldnt happen
          push(`Unable to delete policy "${policy.title}"`)
          return
        case 'OperationError':
          push(`Unable to delete policy "${policy.title}": ${r.message}`)
          return
        default:
          assertNever(r)
      }
    } catch (e) {
      push(`Error deleting policy "${policy.title}"`)
      // eslint-disable-next-line no-console
      console.error('Error deleting policy')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [close, push, deletePolicy, policy.id, policy.title])

  return (
    <>
      <M.DialogTitle>Delete a policy</M.DialogTitle>
      <M.DialogContent>
        You are about to delete the &quot;{policy.title}&quot; policy. This operation is
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

const unmanagedPolicyFormSpec: FormSpec<Model.GQLTypes.UnmanagedPolicyInput> = {
  title: R.pipe(
    R.prop('title'),
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
  roles: R.pipe(
    R.prop('roles'),
    Types.decode(IO.array(IO.type({ id: IO.string }))),
    R.pluck('id'),
    Types.decode(IO.readonlyArray(Types.NonEmptyString)),
  ),
}

// XXX: can we use gql PermissionInput type?
const PermissionInput = IO.type(
  {
    bucket: IO.string,
    level: Model.BucketPermissionLevel,
  },
  'PermissionInput',
)

const managedPolicyFormSpec: FormSpec<Model.GQLTypes.ManagedPolicyInput> = {
  title: R.pipe(
    R.prop('title'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
  roles: R.pipe(
    R.prop('roles'),
    Types.decode(IO.array(IO.type({ id: IO.string }))),
    R.pluck('id'),
    Types.decode(IO.readonlyArray(Types.NonEmptyString)),
  ),
  permissions: R.pipe(
    (values: Record<string, unknown>) =>
      ((values.permissions || []) as BucketPermission[]).map((p) => ({
        bucket: p.bucket.name,
        level: p.level,
      })),
    Types.decode(IO.readonlyArray(PermissionInput)),
  ),
}

interface EditProps {
  policy: Policy
  close: (reason?: string) => void
}

function Edit({ policy, close }: EditProps) {
  const [, updateManaged] = urql.useMutation(POLICY_UPDATE_MANAGED_MUTATION)
  const [, updateUnmanaged] = urql.useMutation(POLICY_UPDATE_UNMANAGED_MUTATION)

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        let res
        if (policy.managed) {
          const input = R.applySpec(managedPolicyFormSpec)(values)
          res = await updateManaged({ input, id: policy.id })
        } else {
          const input = R.applySpec(unmanagedPolicyFormSpec)(values)
          res = await updateUnmanaged({ input, id: policy.id })
        }
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.policyUpdate
        switch (r.__typename) {
          case 'Policy':
            close()
            return undefined
          case 'InvalidInput':
            return mapInputErrors(r.errors, {
              'input.arn': 'arn',
              'input.roles': 'roles',
              'input.title': 'title',
            })
          case 'OperationError':
            return mkFormError(r.message)
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating policy')
        // eslint-disable-next-line no-console
        console.error(e)
        return mkFormError('unexpected')
      }
    },
    [policy.id, policy.managed, updateManaged, updateUnmanaged, close],
  )

  const classes = useStyles()

  const initialValues = React.useMemo(
    () => ({
      title: policy.title,
      permissions: policy.permissions,
      roles: policy.roles,
      arn: policy.managed ? null : policy.arn,
    }),
    [policy],
  )

  const title = (
    <>
      Edit{' '}
      {policy.managed ? (
        <abbr title="This IAM policy is created and managed by Quilt">Quilt</abbr>
      ) : (
        <abbr title="This IAM policy is provided and managed by you or another administrator">
          custom
        </abbr>
      )}{' '}
      policy &quot;{policy.title}&quot;
    </>
  )

  const titleStr = `Edit ${policy.managed ? 'Quilt' : 'custom'} policy "${policy.title}"`

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
                name="title"
                validate={validators.composeAnd(
                  validators.required,
                  validateNonEmptyString,
                )}
                placeholder="Enter policy title"
                label="Title"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a policy title',
                  nonEmptyString: 'Enter a non-empty policy title',
                }}
              />
              {policy.managed ? (
                <>
                  <M.TextField
                    value={policy.arn}
                    label="ARN"
                    fullWidth
                    margin="normal"
                    disabled
                  />
                  <RF.Field
                    className={classes.panel}
                    component={BucketsPermissions}
                    name="permissions"
                    fullWidth
                    margin="normal"
                  />
                </>
              ) : (
                <RF.Field
                  component={Form.Field}
                  name="arn"
                  validate={validators.required as FF.FieldValidator<any>}
                  placeholder="Enter policy ARN"
                  label="ARN"
                  fullWidth
                  margin="normal"
                  errors={{
                    required: 'Enter an ARN',
                  }}
                />
              )}

              <RF.Field
                className={classes.panel}
                component={AssociatedRoles}
                name="roles"
                fullWidth
                margin="normal"
              />

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
  policy: Policy
  openDialog: (render: (props: DialogsOpenProps) => JSX.Element, props?: $TSFixMe) => void
}

function SettingsMenu({ policy, openDialog }: SettingsMenuProps) {
  const openDeleteDialog = React.useCallback(() => {
    openDialog(({ close }) => <Delete {...{ policy, close }} />)
  }, [openDialog, policy])

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
        <M.MenuItem onClick={handleDelete}>Delete</M.MenuItem>
      </M.Menu>
    </>
  )
}

// XXX: move to dialogs module
interface DialogsOpenProps {
  close: (reason?: string) => void
}

export default function Policies() {
  const [{ data }] = urql.useQuery({ query: POLICIES_QUERY })
  const rows = data!.policies

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

  const inlineActions = (policy: Policy) => [
    policy.arn
      ? {
          title: 'Open AWS Console',
          icon: <M.Icon>launch</M.Icon>,
          href: getArnLink(policy.arn),
        }
      : null,
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: () => {
        dialogs.open(({ close }: DialogsOpenProps) => (
          <Edit
            {...{
              policy,
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
          <Table.Toolbar heading="Policies" />
          <Table.Progress />
        </M.Paper>
      }
    >
      <M.Paper>
        {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
        <Table.Toolbar heading="Policies" actions={toolbarActions} />
        <Table.Wrapper>
          <M.Table>
            <Table.Head columns={columns} ordering={ordering} withInlineActions />
            <M.TableBody>
              {ordering.ordered.map((i: Policy) => (
                <M.TableRow hover key={i.id}>
                  {columns.map((col) => (
                    // @ts-expect-error
                    <M.TableCell key={col.id} {...col.props}>
                      {(col.getDisplay || R.identity)(col.getValue(i), i)}
                    </M.TableCell>
                  ))}
                  <M.TableCell align="right" padding="none">
                    <Table.InlineActions actions={inlineActions(i)}>
                      {/* @ts-expect-error */}
                      <SettingsMenu policy={i} openDialog={dialogs.open} />
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
