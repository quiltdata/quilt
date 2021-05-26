import { FORM_ERROR } from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import * as BucketConfig from 'utils/BucketConfig'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import StyledLink from 'utils/StyledLink'
import * as validators from 'utils/validators'

import BucketsPermissions from './BucketsPermissions'
import * as Form from './RFForm'
import * as Table from './Table'
import * as data from './data'
import * as requests from './requests'

function parseError(error) {
  if (APIConnector.HTTPError.is(error, 409, 'Role name already exists')) {
    return {
      [FORM_ERROR]: 'taken',
    }
  }
  if (APIConnector.HTTPError.is(error, 400, 'Invalid name for role')) {
    return {
      [FORM_ERROR]: 'invalid',
    }
  }
  return {
    [FORM_ERROR]: 'unexpected',
  }
}

const useMonoStyles = M.makeStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

function Mono({ children }) {
  const classes = useMonoStyles()
  return <span className={classes.root}>{children}</span>
}

const getARNLink = (arn) => {
  try {
    const [, role] = arn.match(/^arn:aws:iam:[^:]*:\d+:role\/(.+)$/)
    return `https://console.aws.amazon.com/iam/home#/roles/${role}`
  } catch (e) {
    return undefined
  }
}

const columns = [
  {
    id: 'name',
    label: 'Name',
    getValue: R.prop('name'),
    props: { component: 'th', scope: 'row' },
  },
  {
    id: 'arn',
    label: 'ARN',
    getValue: R.prop('arn'),
    getDisplay: (v) => {
      const link = getARNLink(v)
      const mono = <Mono>{v}</Mono>
      return link ? (
        <StyledLink href={link} target="_blank">
          {mono}
        </StyledLink>
      ) : (
        mono
      )
    },
  },
]

const useStyles = M.makeStyles((t) => ({
  panel: {
    marginTop: t.spacing(2),
  },
}))

function useCreateRole() {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  return React.useCallback(
    async (values) => {
      try {
        const res = await requests.createRole(req, values)
        cache.patchOk(data.RolesResource, null, R.append(res))
        push(`Role "${res.name}" created`)
      } catch (error) {
        return parseError(error)
      }
      return undefined
    },
    [req, cache, push],
  )
}

function Create({ close }) {
  const createRole = useCreateRole()
  const onSubmit = React.useCallback(
    async (values) => {
      const error = await createRole(values)
      if (!error) close()
      return error
    },
    [close, createRole],
  )

  const classes = useStyles()
  const buckets = BucketConfig.useBucketConfigs()

  const initialPermissions = React.useMemo(
    () => ({
      permissions: buckets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name }) => ({
          bucket: `s3://${name}`,
          permission: 'None',
        })),
    }),
    [buckets],
  )

  const [isAdvanced, setAdvanced] = React.useState(false)

  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ permissions: initialPermissions }}>
      {({ handleSubmit, submitting, submitFailed, error, invalid }) => (
        <>
          <M.DialogTitle disableTypography>
            <M.Typography variant="h5">Create a role</M.Typography>
          </M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="name"
                validate={validators.required}
                placeholder="Name"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a role name',
                  taken: 'Role with this name already exists',
                  invalid: 'Invalid name for role',
                }}
              />
              <RF.Field
                component={Form.Field}
                name="arn"
                validate={(v) => (isAdvanced ? validators.required(v) : undefined)}
                placeholder="ARN"
                fullWidth
                margin="normal"
                disabled={!isAdvanced}
                errors={{
                  required: 'Enter an ARN',
                }}
              />

              <M.FormControlLabel
                label="Use ARN"
                control={<M.Checkbox checked={isAdvanced} />}
                onChange={() => setAdvanced(!isAdvanced)}
              />

              <M.Collapse in={!isAdvanced}>
                <RF.Field
                  className={classes.panel}
                  component={BucketsPermissions}
                  name="permissions"
                  fullWidth
                  margin="normal"
                  onAdvanced={() => setAdvanced(true)}
                />
              </M.Collapse>

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
              disabled={submitting || (submitFailed && invalid)}
            >
              Create
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

function useDeleteRole(role) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  return React.useCallback(async () => {
    // optimistically remove the role from cache
    cache.patchOk(data.RolesResource, null, R.reject(R.propEq('id', role.id)))
    try {
      await requests.deleteRole(req, role)
      push(`Role "${role.name}" deleted`)
    } catch (error) {
      // ignore if role was not found
      if (APIConnector.HTTPError.is(error, 404, 'Role not found')) return
      // put the role back into cache if it hasnt been deleted properly
      cache.patchOk(data.RolesResource, null, R.append(role))
      push(`Error deleting role "${role.name}"`)
    }
  }, [role, req, cache, push])
}

function Delete({ role, close }) {
  const deleteRole = useDeleteRole(role)
  const doDelete = React.useCallback(() => {
    close()
    return deleteRole()
  }, [close, deleteRole])

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

function useEditRole(role) {
  const req = APIConnector.use()
  const cache = Cache.use()
  return React.useCallback(
    async (values) => {
      try {
        const res = await requests.updateRole(req, role, values)
        cache.patchOk(
          data.RolesResource,
          null,
          R.map((r) => (r.id === role.id ? res : r)),
        )
      } catch (error) {
        parseError(error)
      }
      return undefined
    },
    [req, cache, role],
  )
}

function Edit({ role, close }) {
  const editRole = useEditRole(role)
  const onSubmit = React.useCallback(
    async (values) => {
      const error = await editRole(values)
      if (!error) close()
      return error
    },
    [close, editRole],
  )

  const classes = useStyles()
  const buckets = BucketConfig.useBucketConfigs()

  const initialPermissions = React.useMemo(
    () => ({
      permissions: buckets
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name }) => ({
          bucket: `s3://${name}`,
          permission: 'None',
        })),
    }),
    [buckets],
  )

  const [isAdvanced, setAdvanced] = React.useState(false)

  return (
    <RF.Form
      onSubmit={onSubmit}
      initialValues={R.assoc(
        'permissions',
        initialPermissions,
        R.pick(['name', 'arn'], role),
      )}
    >
      {({ handleSubmit, submitting, submitFailed, error, invalid }) => (
        <>
          <M.DialogTitle>Edit the &quot;{role.name}&quot; role</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="name"
                validate={validators.required}
                placeholder="Name"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a role name',
                  taken: 'Role with this name already exists',
                  invalid: 'Invalid name for role',
                }}
              />
              <RF.Field
                component={Form.Field}
                name="arn"
                validate={validators.required}
                placeholder="ARN"
                fullWidth
                margin="normal"
                disabled={!isAdvanced}
                errors={{
                  required: 'Enter an ARN',
                }}
              />

              <M.FormControlLabel
                label="Use ARN"
                control={<M.Checkbox checked={isAdvanced} />}
                onChange={() => setAdvanced(!isAdvanced)}
              />

              <M.Collapse in={!isAdvanced}>
                <RF.Field
                  className={classes.panel}
                  component={BucketsPermissions}
                  name="permissions"
                  fullWidth
                  margin="normal"
                  errors={{}}
                  onAdvanced={() => setAdvanced(true)}
                />
              </M.Collapse>

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
              disabled={submitting || (submitFailed && invalid)}
            >
              Save
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

export default function Roles({ roles }) {
  const rows = Cache.suspend(roles)

  const ordering = Table.useOrdering({ rows, column: columns[0] })
  const dialogs = Dialogs.use()

  const toolbarActions = [
    {
      title: 'Create',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        dialogs.open(({ close }) => <Create {...{ close }} />)
      }, [dialogs.open]), // eslint-disable-line react-hooks/exhaustive-deps
    },
  ]

  const inlineActions = (role) => [
    {
      title: 'Delete',
      icon: <M.Icon>delete</M.Icon>,
      fn: () => {
        dialogs.open(({ close }) => <Delete {...{ role, close }} />)
      },
    },
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
              {ordering.ordered.map((i) => (
                <M.TableRow hover key={i.id}>
                  {columns.map((col) => (
                    <M.TableCell key={col.id} {...col.props}>
                      {(col.getDisplay || R.identity)(col.getValue(i))}
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
      </M.Paper>
    </React.Suspense>
  )
}
