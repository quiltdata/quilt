import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import Button from '@material-ui/core/Button'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import Icon from '@material-ui/core/Icon'
import Paper from '@material-ui/core/Paper'
import MuiTable from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableRow from '@material-ui/core/TableRow'
import { withStyles } from '@material-ui/styles'

import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import StyledLink from 'utils/StyledLink'
import * as validators from 'utils/validators'

import * as Form from './RFForm'
import * as Table from './Table'
import * as data from './data'

const Mono = withStyles((t) => ({
  root: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))(({ classes, children }) => <span className={classes.root}>{children}</span>)

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

function Create({ close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const onSubmit = React.useCallback(
    (values) =>
      req({
        endpoint: '/roles',
        method: 'POST',
        body: JSON.stringify(values),
      })
        .then((res) => {
          cache.patchOk(data.RolesResource, null, R.append(res))
          push(`Role "${res.name}" created`)
          close()
        })
        .catch((e) => {
          if (APIConnector.HTTPError.is(e, 409, 'Role name already exists')) {
            return {
              [RF.FORM_ERROR]: 'taken',
            }
          }
          if (APIConnector.HTTPError.is(e, 400, 'Invalid name for role')) {
            return {
              [RF.FORM_ERROR]: 'invalid',
            }
          }
          // eslint-disable-next-line no-console
          console.error('Error creating role')
          // eslint-disable-next-line no-console
          console.dir(e)
          return {
            [RF.FORM_ERROR]: 'unexpected',
          }
        }),
    [req, cache, push, close],
  )

  return (
    <RF.Form onSubmit={onSubmit}>
      {({ form, handleSubmit, submitting, submitFailed, error, invalid }) => (
        <>
          <DialogTitle>Create a role</DialogTitle>
          <DialogContent>
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
                errors={{
                  required: 'Enter an ARN',
                }}
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
            <Button onClick={() => close('cancel')} color="primary" disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              color="primary"
              disabled={submitting || (submitFailed && invalid)}
            >
              Create
            </Button>
          </DialogActions>
        </>
      )}
    </RF.Form>
  )
}

function Delete({ role, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const doDelete = React.useCallback(() => {
    close()
    req({ endpoint: `/roles/${role.id}`, method: 'DELETE' })
      .then(() => {
        push(`Role "${role.name}" deleted`)
      })
      .catch((e) => {
        // ignore if role was not found
        if (APIConnector.HTTPError.is(e, 404, 'Role not found')) return
        // put the role back into cache if it hasnt been deleted properly
        cache.patchOk(data.RolesResource, null, R.append(role))
        push(`Error deleting role "${role.name}"`)
        // eslint-disable-next-line no-console
        console.error('Error deleting role')
        // eslint-disable-next-line no-console
        console.dir(e)
      })
    // optimistically remove the role from cache
    cache.patchOk(data.RolesResource, null, R.reject(R.propEq('id', role.id)))
  }, [role, close, req, cache, push])

  return (
    <>
      <DialogTitle>Delete a role</DialogTitle>
      <DialogContent>
        You are about to delete the &quot;{role.name}&quot; role. This operation is
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
    </>
  )
}

function Edit({ role, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const onSubmit = React.useCallback(
    (values) =>
      req({
        endpoint: `/roles/${role.id}`,
        method: 'PUT',
        body: JSON.stringify(values),
      })
        .then((res) => {
          cache.patchOk(
            data.RolesResource,
            null,
            R.map((r) => (r.id === role.id ? res : r)),
          )
          close()
        })
        .catch((e) => {
          if (APIConnector.HTTPError.is(e, 409, 'Role name already exists')) {
            return {
              [RF.FORM_ERROR]: 'taken',
            }
          }
          if (APIConnector.HTTPError.is(e, 400, 'Invalid name for role')) {
            return {
              [RF.FORM_ERROR]: 'invalid',
            }
          }
          // eslint-disable-next-line no-console
          console.error('Error updating role')
          // eslint-disable-next-line no-console
          console.dir(e)
          return {
            [RF.FORM_ERROR]: 'unexpected',
          }
        }),
    [req, cache, close, role.id],
  )

  return (
    <RF.Form onSubmit={onSubmit} initialValues={R.pick(['name', 'arn'], role)}>
      {({ form, handleSubmit, submitting, submitFailed, error, invalid }) => (
        <>
          <DialogTitle>Edit the &quot;{role.name}&quot; role</DialogTitle>
          <DialogContent>
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
                errors={{
                  required: 'Enter an ARN',
                }}
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
            <Button onClick={() => close('cancel')} color="primary" disabled={submitting}>
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
      icon: <Icon>add</Icon>,
      fn: React.useCallback(() => {
        dialogs.open(({ close }) => <Create {...{ close }} />)
      }, [dialogs.open]), // eslint-disable-line react-hooks/exhaustive-deps
    },
  ]

  const inlineActions = (role) => [
    {
      title: 'Delete',
      icon: <Icon>delete</Icon>,
      fn: () => {
        dialogs.open(({ close }) => <Delete {...{ role, close }} />)
      },
    },
    {
      title: 'Edit',
      icon: <Icon>edit</Icon>,
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
        <Paper>
          <Table.Toolbar heading="Roles" />
          <Table.Progress />
        </Paper>
      }
    >
      <Paper>
        {dialogs.render()}
        <Table.Toolbar heading="Roles" actions={toolbarActions} />
        <Table.Wrapper>
          <MuiTable>
            <Table.Head columns={columns} ordering={ordering} withInlineActions />
            <TableBody>
              {ordering.ordered.map((i) => (
                <TableRow hover key={i.id}>
                  {columns.map((col) => (
                    <TableCell key={col.id} {...col.props}>
                      {(col.getDisplay || R.identity)(col.getValue(i))}
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
      </Paper>
    </React.Suspense>
  )
}
